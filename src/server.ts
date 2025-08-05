import express, { type Request, type Response, type NextFunction } from "express"
import cors from "cors"
import "dotenv/config" // Removido a duplicação do require('dotenv').config()
import axios from "axios"
import nodemailer from "nodemailer"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import multer from "multer"
import path from "path"
import { PrismaClient } from "@prisma/client"
import { MercadoPagoConfig, Preference } from "mercadopago"

const prisma = new PrismaClient()
const app = express()

// ─── Environment variables ────────────────────────────────────────────────


const {
  DATABASE_URL,
  MERCADOPAGO_ACCESS_TOKEN,
  FRONTEND_URL,
  BACKEND_URL,
  NOTIFY_EMAIL,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  JWT_SECRET,
  MELHOR_ENVIO_TOKEN,
  STORE_CEP,
} = process.env

if (
  !DATABASE_URL ||
  !MERCADOPAGO_ACCESS_TOKEN ||
  !FRONTEND_URL ||
  !BACKEND_URL ||
  !NOTIFY_EMAIL ||
  !SMTP_HOST ||
  !SMTP_PORT ||
  !SMTP_USER ||
  !SMTP_PASS ||
  !JWT_SECRET
) {
  throw new Error("Missing required environment variables in .env")
}

// ─── Configure MercadoPago client ─────────────────────────────────────────
const mercadoPagoClient = new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN })

// ─── Configure Nodemailer ─────────────────────────────────────────────────
const mailTransport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465, // use TLS on port 465
  auth: { user: SMTP_USER, pass: SMTP_PASS },
})

// ─── Test email configuration on startup ─────────────────────────────────
async function testEmailConfiguration() {
  try {
    console.log("🧪 Testando configuração de email...")
    await mailTransport.verify()
    console.log("✅ Configuração de email verificada com sucesso!")

    // Enviar email de teste opcional (descomente se quiser)
    /*
    await mailTransport.sendMail({
      from: `"Tutty Pijamas" <${SMTP_USER}>`,
      to: NOTIFY_EMAIL,
      subject: "✅ Teste de Configuração de Email",
      html: `
        <h2>🧪 Teste de Email</h2>
        <p>Se você recebeu este email, a configuração está funcionando corretamente!</p>
        <p><strong>Data/Hora:</strong> ${new Date().toLocaleString("pt-BR")}</p>
        <p><strong>Servidor:</strong> ${SMTP_HOST}:${SMTP_PORT}</p>
      `,
    })
    console.log("📧 Email de teste enviado com sucesso!")
    */
  } catch (error) {
    console.error("❌ Erro na configuração de email:", error)
    console.error("Verifique suas credenciais SMTP no arquivo .env")
  }
}

// ─── Express setup ─────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://tuttypijamas.com.br',                    // HostGator
    'https://www.tuttypijamas.com.br',               // HostGator com www
    'https://backends-production-fb81.up.railway.app', // Railway backend (+ https://)
    'http://localhost:3000',                     // Local
    'http://localhost:4001',                     // Backend local
    'http://localhost:5173'                      // Vite local
  ],
  credentials: true
}))

app.post("/api/create-admin", async (req, res) => {
  try {
    const hash = await bcrypt.hash("041220marry", 10)
    const admin = await prisma.user.create({
      data: { 
        name: "Administrador Tutty", 
        email: "sarahmarry.loja@gmail.com", 
        passwordHash: hash, 
        role: "admin" 
      },
    })
    res.json({ success: true, admin: { id: admin.id, email: admin.email } })
  } catch (e: any) {
    if (e.code === "P2002") {
      return res.json({ message: "Admin já existe" })
    }
    res.status(500).json({ error: e.message })
  }
})

// Endpoint para verificar dados do admin
app.get("/api/debug-admin", async (req, res) => {
  try {
    const admin = await prisma.user.findUnique({ 
      where: { email: "sarahmarry.loja@gmail.com" } 
    })
    
    if (!admin) {
      return res.json({ found: false, message: "Admin não encontrado" })
    }
    
    res.json({ 
      found: true,
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        hasPassword: !!admin.passwordHash
      }
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.use(express.json())
app.use("/images", express.static(path.join(__dirname, "../public/images")))

// ─── Multer setup for file uploads ─────────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(__dirname, "../public/images"))
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
      const ext = path.extname(file.originalname)
      cb(null, `image-${uniqueSuffix}${ext}`)
    },
  }),
})

// ─── JWT payload typing ────────────────────────────────────────────────────
interface MyJwtPayload {
  sub: number
  name: string
  email: string
  role: string
  iat?: number
  exp?: number
}

// ─── Auth & Admin middlewares ──────────────────────────────────────────────
function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" })
  }
  const token = authHeader.slice(7)
  try {
    const verified = jwt.verify(token, JWT_SECRET!) as MyJwtPayload | string
    if (typeof verified === "object" && "sub" in verified) {
      ;(req as any).user = verified
      return next()
    }
    return res.status(401).json({ error: "Invalid token" })
  } catch {
    return res.status(401).json({ error: "Invalid token" })
  }
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as MyJwtPayload
  if (!user || user.role !== "admin") {
    return res.status(403).json({ error: "Admin access only" })
  }
  next()
}

// ─── Routes ────────────────────────────────────────────────────────────────

// 1) Register
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body as {
      name: string
      email: string
      password: string
    }
    const hash = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, passwordHash: hash, role: "user" },
    })
    const token = jwt.sign({ sub: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET!, {
      expiresIn: "2h",
    })
    return res.status(201).json({ token })
  } catch (e: any) {
    if (e.code === "P2002") {
      return res.status(409).json({ error: "Email already registered" })
    }
    return res.status(500).json({ error: "Error registering user" })
  }
})

// 2) Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string }
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" })
    }
    const match = await bcrypt.compare(password, user.passwordHash)
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" })
    }
    const token = jwt.sign({ sub: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET!, {
      expiresIn: "2h",
    })
    return res.json({ token })
  } catch {
    return res.status(500).json({ error: "Login failed" })
  }
})

// 3) Public product listing
app.get("/api/products", async (_req, res) => {
  const list = await prisma.product.findMany()
  res.json(list)
})

app.get("/api/products/:id", async (req, res) => {
  const id = Number(req.params.id)
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) {
    return res.status(404).json({ error: "Product not found" })
  }
  res.json(product)
})

// ─── ADMIN CRUD FOR PRODUCTS ────────────────────────────────────────────────
app.get("/api/admin/products", authenticateJWT, requireAdmin, async (_req, res) => {
  const all = await prisma.product.findMany()
  res.json(all)
})

app.post("/api/admin/products", authenticateJWT, requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const rawPrice = req.body.price
    const price = typeof rawPrice === "string" ? Number.parseFloat(rawPrice) : Number(rawPrice)
    if (isNaN(price)) {
      return res.status(400).json({ error: "Invalid price" })
    }
    const imageUrl = req.file ? req.file.filename : req.body.imageUrl
    const { name, category, description } = req.body
    const created = await prisma.product.create({
      data: { name, price, imageUrl, category, description },
    })
    res.status(201).json(created)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to create product" })
  }
})

app.put("/api/admin/products/:id", authenticateJWT, requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const rawPrice = req.body.price
    const price = typeof rawPrice === "string" ? Number.parseFloat(rawPrice) : Number(rawPrice)
    if (isNaN(price)) {
      return res.status(400).json({ error: "Invalid price" })
    }
    const imageUrl = req.file ? req.file.filename : req.body.imageUrl
    const { name, category, description } = req.body
    const updated = await prisma.product.update({
      where: { id },
      data: { name, price, imageUrl, category, description },
    })
    res.json(updated)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Failed to update product" })
  }
})

app.delete("/api/admin/products/:id", authenticateJWT, requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  await prisma.product.delete({ where: { id } })
  res.status(204).send()
})

// ─── SHIPPING ROUTES (UPDATED) ──────────────────────────────────────────────
// Interface para opções de frete da Melhor Envio
interface ShippingOption {
  id: number
  name: string
  company: {
    id: number
    name: string
    picture: string
  }
  price: string
  custom_price: string
  discount: string
  currency: string
  delivery_time: number
  delivery_range: {
    min: number
    max: number
  }
  packages: Array<{
    price: string
    discount: string
    format: string
    weight: string
    insurance_value: string
    products: any[]
  }>
  error?: any
}

// Rota para calcular frete com Melhor Envio
app.post("/api/shipping/calculate", async (req, res) => {
  try {
    const { cep, items } = req.body
    if (!cep || !items || items.length === 0) {
      return res.status(400).json({ error: "CEP e itens são obrigatórios" })
    }

    if (!MELHOR_ENVIO_TOKEN) {
      console.warn("Token da Melhor Envio não configurado, usando cálculo simples")
      // Fallback para cálculo simples se não tiver token
      return fallbackShippingCalculation(cep, res)
    }

    // Calcular peso total e valor total
    const totalWeight = items.reduce((total: number, item: any) => {
      const itemWeight = item.weight || 0.5 // kg
      return total + itemWeight * item.quantity
    }, 0)

    const totalValue = items.reduce((total: number, item: any) => {
      return total + item.price * item.quantity
    }, 0)

    // Dados para a API da Melhor Envio
    const shippingData = {
      from: {
        postal_code: STORE_CEP || "01310-100",
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

    console.log("Calculando frete para:", { cep, totalWeight, totalValue })

    // Fazer requisição para a API da Melhor Envio
    const response = await fetch("https://melhorenvio.com.br/api/v2/me/shipment/calculate", {
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
      // Fallback para cálculo simples em caso de erro
      return fallbackShippingCalculation(cep, res)
    }

    const shippingOptions = (await response.json()) as ShippingOption[]

    // Filtrar apenas opções válidas
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
      // Fallback para cálculo simples se não houver opções
      return fallbackShippingCalculation(cep, res)
    }

    console.log(`Encontradas ${validOptions.length} opções de frete`)
    res.json(validOptions)
  } catch (error) {
    console.error("Erro ao calcular frete:", error)
    // Fallback para cálculo simples em caso de erro
    return fallbackShippingCalculation(req.body.cep, res)
  }
})

// Função de fallback para cálculo simples de frete
async function fallbackShippingCalculation(cep: string, res: Response) {
  try {
    const cleanCep = cep.replace(/\D/g, "")
    const viaCep = await axios.get(`https://viacep.com.br/ws/${cleanCep}/json/`)
    if (viaCep.data.erro) {
      return res.status(404).json({ error: "CEP not found" })
    }

    const uf = viaCep.data.uf as string
    let cost = 40
    let deliveryTime = 10

    if (["SC", "RS", "PR"].includes(uf)) {
      cost = 15
      deliveryTime = 5
    } else if (["SP", "RJ", "MG", "ES"].includes(uf)) {
      cost = 25
      deliveryTime = 7
    } else if (["BA", "PE", "CE"].includes(uf)) {
      cost = 30
      deliveryTime = 8
    }

    // Retorna no formato esperado pelo frontend
    const fallbackOptions = [
      {
        id: 1,
        name: "PAC",
        company: {
          id: 1,
          name: "Correios",
          picture: "",
        },
        price: cost.toString(),
        custom_price: cost.toString(),
        discount: "0.00",
        currency: "BRL",
        delivery_time: deliveryTime,
        delivery_range: {
          min: deliveryTime,
          max: deliveryTime + 2,
        },
        packages: [],
      },
    ]

    res.json(fallbackOptions)
  } catch (error) {
    console.error("Erro no fallback de frete:", error)
    res.status(500).json({ error: "Failed to calculate shipping" })
  }
}

// Manter rota antiga para compatibilidade (DEPRECATED)
app.get("/api/shipping", async (req, res) => {
  const cep = String(req.query.cep || "").replace(/\D/g, "")
  if (!cep) {
    return res.status(400).json({ error: "CEP is required" })
  }
  try {
    const viaCep = await axios.get(`https://viacep.com.br/ws/${cep}/json/`)
    if (viaCep.data.erro) {
      return res.status(404).json({ error: "CEP not found" })
    }
    const uf = viaCep.data.uf as string
    let cost = 40
    if (["SC", "RS", "PR"].includes(uf)) cost = 15
    else if (["SP", "RJ", "MG", "ES"].includes(uf)) cost = 25
    else if (["BA", "PE", "CE"].includes(uf)) cost = 30
    res.json({ cost })
  } catch {
    res.status(500).json({ error: "Failed to calculate shipping" })
  }
})

// ─── END SHIPPING ROUTES ────────────────────────────────────────────────────

// ─── EMAIL HELPER FUNCTIONS ─────────────────────────────────────────────────
async function sendAdminNotificationEmail(
  orderData: any,
  items: any[],
  existingProducts: any[],
  shippingInfo: string,
  mpResult: any,
) {
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">🛍️ Novo Pedido Recebido!</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px;">Pedido realizado em ${new Date().toLocaleString("pt-BR")}</p>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #ddd;">
        <div style="margin-bottom: 30px;">
          <h3 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">👤 Dados do Cliente</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
            <p><strong>Nome:</strong> ${orderData.customerName}</p>
            <p><strong>Email:</strong> ${orderData.customerEmail}</p>
            <p><strong>CPF:</strong> ${orderData.customerCPF}</p>
          </div>
        </div>

        <div style="margin-bottom: 30px;">
          <h3 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">📍 Endereço de Entrega</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
            <p>${orderData.street}, ${orderData.number}${orderData.complement ? ` - ${orderData.complement}` : ""}</p>
            <p>${orderData.neighborhood} - ${orderData.city}/${orderData.state}</p>
            <p>CEP: ${orderData.cep}</p>
          </div>
        </div>

        <div style="margin-bottom: 30px;">
          <h3 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">🛒 Produtos</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #667eea; color: white;">
                <th style="padding: 12px; text-align: left;">Produto</th>
                <th style="padding: 12px; text-align: center;">Qtd</th>
                <th style="padding: 12px; text-align: right;">Preço Unit.</th>
                <th style="padding: 12px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map((i) => {
                  const p = existingProducts.find((x) => x.id === i.id)!
                  return `
                  <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 12px;">
                      <strong>${p.name}</strong><br>
                      <small style="color: #666;">Tamanho: ${i.size}</small>
                    </td>
                    <td style="padding: 12px; text-align: center;">${i.quantity}</td>
                    <td style="padding: 12px; text-align: right;">R$ ${i.price.toFixed(2).replace(".", ",")}</td>
                    <td style="padding: 12px; text-align: right; font-weight: bold;">R$ ${(i.price * i.quantity).toFixed(2).replace(".", ",")}</td>
                  </tr>
                `
                })
                .join("")}
            </tbody>
          </table>
        </div>

        <div style="margin-bottom: 30px;">
          <h3 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">💰 Resumo Financeiro</h3>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>Subtotal:</span>
              <span>R$ ${(orderData.totalAmount - orderData.shippingCost).toFixed(2).replace(".", ",")}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>Frete:</span>
              <span>R$ ${orderData.shippingCost.toFixed(2).replace(".", ",")}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 1.2em; font-weight: bold; color: #667eea; border-top: 2px solid #667eea; padding-top: 10px;">
              <span>TOTAL:</span>
              <span>R$ ${orderData.totalAmount.toFixed(2).replace(".", ",")}</span>
            </div>
          </div>
        </div>

        ${shippingInfo}

        <div style="background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <strong>⚠️ Ação Necessária:</strong> Um novo pedido foi realizado e está aguardando processamento.
          <br><a href="${mpResult.init_point}" style="color: #155724; font-weight: bold;">Clique aqui para ver o pagamento</a>
        </div>
      </div>

      <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; color: #666;">
        <p>Este email foi enviado automaticamente pelo sistema da loja.</p>
        <p>Data/Hora: ${new Date().toLocaleString("pt-BR")}</p>
      </div>
    </div>
  `

  await mailTransport.sendMail({
    from: `"Tutty Pijamas" <${SMTP_USER}>`,
    to: NOTIFY_EMAIL,
    subject: `🛍️ Novo Pedido - ${orderData.customerName}`,
    html: emailHtml,
  })
}

async function sendCustomerConfirmationEmail(
  customerEmail: string,
  customerName: string,
  items: any[],
  existingProducts: any[],
  totalAmount: number,
  shippingInfo: string,
  mpResult: any,
) {
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">✅ Pedido Confirmado!</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px;">Olá, ${customerName}!</p>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #ddd;">
        <h2>🎉 Seu pedido foi recebido com sucesso!</h2>
        <p>Obrigado por sua compra! Seu pedido está sendo processado e você receberá atualizações sobre o status da entrega.</p>
        
        <div style="font-weight: bold; font-size: 20px; color: #28a745; text-align: center; padding: 15px; background: #d4edda; border-radius: 8px; margin: 15px 0;">
          💳 VALOR TOTAL: R$ ${totalAmount.toFixed(2).replace(".", ",")}
        </div>

        <p><strong>📦 Itens do seu pedido:</strong></p>
        ${items
          .map((i) => {
            const p = existingProducts.find((x) => x.id === i.id)!
            return `
            <div style="padding: 10px; background: white; margin: 5px 0; border-radius: 4px; border-left: 4px solid #28a745; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              ${p.name} - Tamanho: ${i.size} (${i.quantity}x) = R$ ${(i.price * i.quantity).toFixed(2).replace(".", ",")}
            </div>
          `
          })
          .join("")}

        ${shippingInfo}

        <div style="text-align: center; margin: 20px 0;">
          <a href="${mpResult.init_point}" style="display: inline-block; background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            🔒 Finalizar Pagamento
          </a>
        </div>
      </div>

      <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; color: #666;">
        <p>Obrigado por escolher nossa loja!</p>
        <p>Em caso de dúvidas, entre em contato conosco.</p>
      </div>
    </div>
  `

  await mailTransport.sendMail({
    from: `"Tutty Pijamas" <${SMTP_USER}>`,
    to: customerEmail,
    subject: "✅ Confirmação do seu pedido",
    html: emailHtml,
  })
}

// 6) Checkout + Mercado Pago + Emails
interface OrderItemInput {
  id: number
  quantity: number
  size: string
  price: number
}

interface CreatePaymentBody {
  customerName: string
  customerEmail: string
  customerCPF: string
  address: {
    cep: string
    street: string
    number: string
    complement?: string
    neighborhood: string
    city: string
    state: string
  }
  items: OrderItemInput[]
  shippingCost: number
  totalAmount: number
  shipping?: {
    cost: number
    method: string
    service: string
    deliveryTime: string
    melhorEnvioId?: number
  }
  // Novos campos para dados especiais do cliente
  includeAllCustomerData?: boolean
  customerData?: {
    fullName: string
    email: string
    cpf: string
    cpfFormatted: string
    cpfNumbers: string
    fullAddress: {
      cep: string
      cepFormatted: string
      cepNumbers: string
      street: string
      number: string
      complement: string
      neighborhood: string
      city: string
      state: string
      fullAddressString: string
      addressForEmail: string
    }
    orderSummary: {
      subtotal: number
      shippingCost: number
      totalAmount: number
      itemCount: number
    }
    emailData: {
      customerInfo: string
      deliveryAddress: string
      completeCustomerData: string
    }
  }
}

app.post("/api/create-payment", async (req, res) => {
  try {
    console.log("=== INÍCIO DO PROCESSO DE PAGAMENTO ===")
    console.log("Body recebido:", JSON.stringify(req.body, null, 2))

    const { customerName, customerEmail, customerCPF, address, items, shippingCost, totalAmount, shipping } =
      req.body as CreatePaymentBody

    // Validações básicas
    if (!customerName) {
      console.error("❌ customerName está faltando")
      return res.status(400).json({ error: "Nome do cliente é obrigatório" })
    }
    if (!customerEmail) {
      console.error("❌ customerEmail está faltando")
      return res.status(400).json({ error: "Email do cliente é obrigatório" })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.error("❌ Items inválidos:", items)
      return res.status(400).json({ error: "Carrinho está vazio ou inválido" })
    }
    if (!address) {
      console.error("❌ Endereço está faltando")
      return res.status(400).json({ error: "Endereço é obrigatório" })
    }
    if (typeof shippingCost !== "number" || isNaN(shippingCost)) {
      console.error("❌ shippingCost inválido:", shippingCost, typeof shippingCost)
      return res.status(400).json({ error: "Custo de frete inválido" })
    }
    if (typeof totalAmount !== "number" || isNaN(totalAmount)) {
      console.error("❌ totalAmount inválido:", totalAmount, typeof totalAmount)
      return res.status(400).json({ error: "Valor total inválido" })
    }

    console.log("✅ Validações básicas passaram")

    // Preparar dados para o Prisma
    const orderData = {
      customerName: String(customerName).trim(),
      customerEmail: String(customerEmail).trim(),
      customerCPF: String(customerCPF).replace(/\D/g, ""),
      totalAmount: Number(totalAmount),
      shippingCost: Number(shippingCost),
      cep: String(address.cep).replace(/\D/g, ""),
      street: String(address.street).trim(),
      number: String(address.number).trim(),
      complement: address.complement ? String(address.complement).trim() : null,
      neighborhood: String(address.neighborhood).trim(),
      city: String(address.city).trim(),
      state: String(address.state).trim(),
    }

    const itemsData = items.map((item, index) => {
      console.log(`Item ${index}:`, item)
      if (!item.id || typeof item.id !== "number") {
        throw new Error(`Item ${index}: ID inválido (${item.id})`)
      }
      if (!item.quantity || typeof item.quantity !== "number" || item.quantity <= 0) {
        throw new Error(`Item ${index}: Quantidade inválida (${item.quantity})`)
      }
      if (!item.size || typeof item.size !== "string") {
        throw new Error(`Item ${index}: Tamanho inválido (${item.size})`)
      }
      if (!item.price || typeof item.price !== "number" || item.price <= 0) {
        throw new Error(`Item ${index}: Preço inválido (${item.price})`)
      }
      return {
        productId: Number(item.id),
        quantity: Number(item.quantity),
        size: String(item.size).trim(),
        unitPrice: Number(item.price),
      }
    })

    console.log("📦 Dados preparados para o Prisma:")
    console.log("Order data:", JSON.stringify(orderData, null, 2))
    console.log("Items data:", JSON.stringify(itemsData, null, 2))

    // Verificar se os produtos existem
    console.log("🔍 Verificando se os produtos existem...")
    const productIds = items.map((i) => i.id)
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
    })
    console.log(`Produtos encontrados: ${existingProducts.length}/${productIds.length}`)

    if (existingProducts.length !== productIds.length) {
      const missingIds = productIds.filter((id) => !existingProducts.find((p) => p.id === id))
      console.error("❌ Produtos não encontrados:", missingIds)
      return res.status(400).json({ error: `Produtos não encontrados: ${missingIds.join(", ")}` })
    }

    console.log("✅ Todos os produtos existem")

    // Criar o pedido
    console.log("💾 Criando pedido no banco...")
    const order = await prisma.order.create({
      data: {
        ...orderData,
        items: {
          create: itemsData,
        },
      },
      include: { items: true },
    })

    console.log("✅ Pedido criado com sucesso! ID:", order.id)

    // Continuar com o resto do processo (MercadoPago, emails, etc.)
    const mpItems = items.map((i: OrderItemInput) => {
      const p = existingProducts.find((x) => x.id === i.id)!
      return {
        id: p.id.toString(),
        title: p.name,
        quantity: i.quantity,
        unit_price: p.price,
        picture_url: `${BACKEND_URL}/images/${p.imageUrl}`,
        category_id: p.category,
      }
    })

    mpItems.push({
      id: "shipping",
      title: shipping ? `Frete - ${shipping.method}` : "Frete",
      quantity: 1,
      unit_price: shippingCost,
      picture_url: "",
      category_id: "Frete",
    })

    console.log("💳 Criando preferência no MercadoPago...")
    const preference = new Preference(mercadoPagoClient)
    const mpResult = await preference.create({
      body: {
        items: mpItems,
        payer: { name: customerName, email: customerEmail },
        back_urls: { success: FRONTEND_URL, failure: FRONTEND_URL, pending: FRONTEND_URL },
        notification_url: `${BACKEND_URL}/api/mp-webhook`,
      },
    })

    console.log("✅ Preferência criada no MercadoPago")

    // Preparar informações de frete para email
    const shippingInfo = shipping
      ? `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">🚚 Informações de Frete</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
            <p><strong>Transportadora:</strong> ${shipping.method}</p>
            <p><strong>Serviço:</strong> ${shipping.service}</p>
            <p><strong>Prazo:</strong> ${shipping.deliveryTime}</p>
            <p><strong>Valor:</strong> R$ ${shippingCost.toFixed(2).replace(".", ",")}</p>
          </div>
        </div>
      `
      : `
        <div style="margin-bottom: 20px;">
          <h3 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">🚚 Frete</h3>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
            <p><strong>Valor:</strong> R$ ${shippingCost.toFixed(2).replace(".", ",")}</p>
          </div>
        </div>
      `

    console.log("📧 Enviando emails...")

    // Enviar emails com tratamento de erro melhorado
    const emailStatus = {
      adminSent: false,
      customerSent: false,
      errors: [] as string[],
    }

    try {
      // Enviar email para admin
      await sendAdminNotificationEmail(orderData, items, existingProducts, shippingInfo, mpResult)
      emailStatus.adminSent = true
      console.log("✅ Email de notificação admin enviado com sucesso")
    } catch (adminEmailError) {
      console.error("❌ Erro ao enviar email admin:", adminEmailError)
      emailStatus.errors.push(
        `Admin: ${adminEmailError instanceof Error ? adminEmailError.message : "Erro desconhecido"}`,
      )
    }

    try {
      // Enviar email para cliente
      await sendCustomerConfirmationEmail(
        customerEmail,
        customerName,
        items,
        existingProducts,
        totalAmount,
        shippingInfo,
        mpResult,
      )
      emailStatus.customerSent = true
      console.log("✅ Email de confirmação cliente enviado com sucesso")
    } catch (customerEmailError) {
      console.error("❌ Erro ao enviar email cliente:", customerEmailError)
      emailStatus.errors.push(
        `Cliente: ${customerEmailError instanceof Error ? customerEmailError.message : "Erro desconhecido"}`,
      )
    }

    // Log do status final dos emails
    if (emailStatus.adminSent && emailStatus.customerSent) {
      console.log("✅ Todos os emails enviados com sucesso")
    } else {
      console.warn("⚠️ Alguns emails falharam:", emailStatus.errors)
    }

    console.log("🎉 Processo concluído com sucesso!")

    res.json({
      id: mpResult.id,
      init_point: mpResult.init_point,
      emailStatus: {
        success: emailStatus.adminSent && emailStatus.customerSent,
        admin: emailStatus.adminSent,
        customer: emailStatus.customerSent,
        errors: emailStatus.errors,
      },
    })
  } catch (err: any) {
    console.error("💥 ERRO COMPLETO:")
    console.error("Tipo do erro:", err.constructor.name)
    console.error("Mensagem:", err.message)
    console.error("Stack:", err.stack)
    if (err.code) {
      console.error("Código do erro:", err.code)
    }
    if (err.meta) {
      console.error("Meta informações:", err.meta)
    }

    res.status(500).json({
      error: "Erro interno do servidor ao processar pagamento",
      details: err.message,
      type: err.constructor.name,
    })
  }
})

// 🧪 ROTA DE TESTE PARA EMAIL
app.post("/api/test-email", async (req, res) => {
  try {
    console.log("🧪 Testando envio de email...")

    await mailTransport.sendMail({
      from: `"Tutty Pijamas" <${SMTP_USER}>`,
      to: NOTIFY_EMAIL,
      subject: "✅ Teste de Email - Configuração OK",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #28a745;">🧪 Teste de Email</h2>
          <p>Se você recebeu este email, a configuração está funcionando corretamente!</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Data/Hora:</strong> ${new Date().toLocaleString("pt-BR")}</p>
            <p><strong>Servidor SMTP:</strong> ${SMTP_HOST}:${SMTP_PORT}</p>
            <p><strong>Usuário:</strong> ${SMTP_USER}</p>
            <p><strong>Email de notificação:</strong> ${NOTIFY_EMAIL}</p>
          </div>
          <p style="color: #28a745; font-weight: bold;">✅ Configuração de email funcionando perfeitamente!</p>
        </div>
      `,
    })

    console.log("✅ Email de teste enviado com sucesso!")
    res.json({
      success: true,
      message: "Email de teste enviado com sucesso!",
      config: {
        host: SMTP_HOST,
        port: SMTP_PORT,
        user: SMTP_USER,
        notifyEmail: NOTIFY_EMAIL,
      },
    })
  } catch (error) {
    console.error("❌ Erro no teste de email:", error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
      config: {
        host: SMTP_HOST,
        port: SMTP_PORT,
        user: SMTP_USER,
        notifyEmail: NOTIFY_EMAIL,
      },
    })
  }
})

// 7) Mercado Pago webhook
app.post("/api/mp-webhook", (_req, res) => {
  console.log("MP webhook:", _req.body)
  res.sendStatus(200)
})

// Start server
const PORT = Number(process.env.PORT) || 4001

app.listen(PORT, async () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`)
  console.log(`📦 Melhor Envio configurado: ${MELHOR_ENVIO_TOKEN ? "SIM" : "NÃO"}`)
  console.log(`🏪 CEP da loja: ${STORE_CEP || "01310-100"}`)

  // Testar configuração de email na inicialização
  await testEmailConfiguration()

  console.log(`📧 Configuração de email:`)
  console.log(`   - Host: ${SMTP_HOST}:${SMTP_PORT}`)
  console.log(`   - User: ${SMTP_USER}`)
  console.log(`   - Notify: ${NOTIFY_EMAIL}`)
  console.log(`   - Teste: POST http://localhost:${PORT}/api/test-email`)
})
