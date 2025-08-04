import express from "express"
import { MercadoPagoConfig, Preference } from "mercadopago"
// CORREÇÃO: Import atualizado para o EmailService em TypeScript
import emailService from "../services/emailService" // Agora é .ts

const router = express.Router()

// Rota para criar preferência de pagamento
router.post("/create-payment", async (req, res) => {
  try {
    const orderData = req.body

    console.log("🚀 Recebendo dados do pedido:", {
      customerName: orderData.customerData?.name || orderData.customerName,
      totalAmount: orderData.totalAmount,
      itemsCount: orderData.items?.length || 0,
      hasEmailNotification: !!orderData.emailNotification,
    })

    // Configuração do MercadoPago
    const client = new MercadoPagoConfig({
      accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
    })
    const preference = new Preference(client)

    // Criar preferência de pagamento com dados estruturados
    const preferenceData = {
      items: orderData.items.map((item: any) => ({
        id: item.id.toString(),
        title: item.name,
        quantity: item.quantity,
        unit_price: Number(item.price),
        currency_id: "BRL",
      })),
      shipments: {
        cost: Number(orderData.shippingCost),
        mode: "not_specified" as const,
      },
      payer: {
        name: orderData.customerData?.name || orderData.customerName,
        email: orderData.customerData?.email || orderData.customerEmail,
        identification: {
          type: "CPF" as const,
          number: orderData.customerData?.cpf || orderData.customerCPF,
        },
        address: {
          street_name: orderData.customerData?.address?.street || orderData.address?.street,
          street_number: (orderData.customerData?.address?.number || orderData.address?.number).toString(),
          zip_code: orderData.customerData?.address?.cep || orderData.address?.cep,
        },
      },
      back_urls: {
        success: `${process.env.FRONTEND_URL}/success`,
        failure: `${process.env.FRONTEND_URL}/failure`,
        pending: `${process.env.FRONTEND_URL}/pending`,
      },
      auto_return: "approved" as const,
      notification_url: `${process.env.BACKEND_URL}/api/webhook/mercadopago`,
    }

    console.log("💳 Criando preferência no MercadoPago...")
    const result = await preference.create({ body: preferenceData })

    console.log("✅ Preferência criada com sucesso:", {
      id: result.id,
      init_point: result.init_point ? "✅" : "❌",
    })

    // 📧 ENVIAR EMAILS USANDO O EMAILSERVICE ATUALIZADO
    console.log("📧 Iniciando processo de envio de emails...")

    try {
      // Usar o novo método que envia ambos os emails
      const emailResults = await emailService.sendOrderEmails(orderData)

      console.log("📧 Resultado do envio de emails:", {
        success: emailResults.success,
        adminSent: emailResults.admin?.success || false,
        customerSent: emailResults.customer?.success || false,
        errors: emailResults.errors,
      })

      // Log detalhado dos resultados
      if (emailResults.admin) {
        console.log(
          `📨 Email admin: ${emailResults.admin.success ? "✅ Enviado" : "❌ Falhou"} - ${emailResults.admin.messageId || emailResults.admin.error}`,
        )
      }

      if (emailResults.customer) {
        console.log(
          `📧 Email cliente: ${emailResults.customer.success ? "✅ Enviado" : "❌ Falhou"} - ${emailResults.customer.messageId || emailResults.customer.error}`,
        )
      }

      // Resposta incluindo status dos emails
      res.json({
        id: result.id,
        init_point: result.init_point,
        sandbox_init_point: result.sandbox_init_point,
        emailStatus: {
          success: emailResults.success,
          admin: emailResults.admin?.success || false,
          customer: emailResults.customer?.success || false,
          errors: emailResults.errors,
        },
      })
    } catch (emailError) {
      console.error("❌ Erro crítico no envio de emails:", emailError)

      // Mesmo com erro de email, retornar sucesso do pagamento
      res.json({
        id: result.id,
        init_point: result.init_point,
        sandbox_init_point: result.sandbox_init_point,
        emailStatus: {
          success: false,
          admin: false,
          customer: false,
          errors: [`Erro crítico: ${emailError instanceof Error ? emailError.message : "Erro desconhecido"}`],
        },
      })
    }
  } catch (error) {
    console.error("❌ Erro ao criar preferência:", error)

    // Log detalhado do erro
    if (error instanceof Error) {
      console.error("Detalhes do erro:", {
        message: error.message,
        stack: error.stack,
      })
    }

    res.status(500).json({
      error: "Erro interno do servidor",
      details: error instanceof Error ? error.message : "Erro desconhecido",
    })
  }
})

// 🧪 ROTA DE TESTE PARA EMAILS (OPCIONAL)
router.post("/test-email", async (req, res) => {
  try {
    console.log("🧪 Testando configuração de email...")

    const testResult = await emailService.testEmailConfiguration()

    if (testResult.success) {
      console.log("✅ Teste de email bem-sucedido!")
      res.json({
        success: true,
        message: "Email de teste enviado com sucesso!",
        messageId: testResult.messageId,
      })
    } else {
      console.log("❌ Teste de email falhou:", testResult.error)
      res.status(500).json({
        success: false,
        error: testResult.error,
      })
    }
  } catch (error) {
    console.error("❌ Erro no teste de email:", error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    })
  }
})

export default router
