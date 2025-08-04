const express = require("express")
const router = express.Router()

// Configurações da Melhor Envio
const MELHOR_ENVIO_TOKEN = process.env.MELHOR_ENVIO_TOKEN || "YOUR_TOKEN_HERE"
const MELHOR_ENVIO_API = "https://melhorenvio.com.br/api/v2/me"
const STORE_CEP = process.env.STORE_CEP || "01310-100" // CEP da sua loja

// Rota para calcular frete
router.post("/calculate", async (req, res) => {
  try {
    const { cep, items } = req.body

    if (!cep || !items || items.length === 0) {
      return res.status(400).json({ error: "CEP e itens são obrigatórios" })
    }

    // Calcular peso total e valor total
    const totalWeight = items.reduce((total, item) => {
      // Peso estimado por item (ajuste conforme seus produtos)
      const itemWeight = item.weight || 0.5 // kg
      return total + itemWeight * item.quantity
    }, 0)

    const totalValue = items.reduce((total, item) => {
      return total + item.price * item.quantity
    }, 0)

    // Dados para a API da Melhor Envio
    const shippingData = {
      from: {
        postal_code: STORE_CEP,
      },
      to: {
        postal_code: cep.replace(/\D/g, ""),
      },
      products: [
        {
          id: "1",
          width: 20, // cm - ajuste conforme seus produtos
          height: 10, // cm
          length: 30, // cm
          weight: Math.max(totalWeight, 0.1), // mínimo 0.1kg
          insurance_value: totalValue,
          quantity: 1,
        },
      ],
    }

    // Fazer requisição para a API da Melhor Envio
    const response = await fetch(`${MELHOR_ENVIO_API}/shipment/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`,
        "User-Agent": "Aplicação (contato@suaempresa.com)",
      },
      body: JSON.stringify(shippingData),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Erro da API Melhor Envio:", errorData)
      throw new Error(`Erro da API: ${response.status}`)
    }

    const shippingOptions = await response.json()

    // Filtrar apenas opções válidas e adicionar informações extras
    const validOptions = shippingOptions
      .filter((option) => option.error === null || option.error === undefined)
      .map((option) => ({
        id: option.id,
        name: option.name,
        company: {
          id: option.company.id,
          name: option.company.name,
          picture: option.company.picture,
        },
        price: option.price,
        custom_price: option.custom_price,
        discount: option.discount || "0.00",
        currency: option.currency,
        delivery_time: option.delivery_time,
        delivery_range: {
          min: option.delivery_range?.min || option.delivery_time,
          max: option.delivery_range?.max || option.delivery_time,
        },
        packages: option.packages || [],
      }))

    if (validOptions.length === 0) {
      return res.status(400).json({
        error: "Nenhuma opção de frete disponível para este CEP",
      })
    }

    res.json(validOptions)
  } catch (error) {
    console.error("Erro ao calcular frete:", error)
    res.status(500).json({
      error: "Erro interno do servidor ao calcular frete",
      details: error.message,
    })
  }
})

// Rota para validar CEP (opcional)
router.get("/validate-cep/:cep", async (req, res) => {
  try {
    const { cep } = req.params
    const cleanCEP = cep.replace(/\D/g, "")

    if (cleanCEP.length !== 8) {
      return res.status(400).json({ error: "CEP inválido" })
    }

    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`)
    const data = await response.json()

    if (data.erro) {
      return res.status(404).json({ error: "CEP não encontrado" })
    }

    res.json({
      valid: true,
      address: {
        street: data.logradouro,
        neighborhood: data.bairro,
        city: data.localidade,
        state: data.uf,
      },
    })
  } catch (error) {
    console.error("Erro ao validar CEP:", error)
    res.status(500).json({ error: "Erro ao validar CEP" })
  }
})

module.exports = router
