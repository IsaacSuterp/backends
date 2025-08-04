import dotenv from "dotenv"

// Carrega as variáveis de ambiente
dotenv.config()

// Lista de variáveis obrigatórias
const requiredEnvVars = [
  "PORT",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "NOTIFY_EMAIL",
  "FROM_EMAIL",
  "FRONTEND_URL",
]

// Função para validar variáveis de ambiente
export function validateEnvVars(): void {
  const missingVars: string[] = []

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingVars.push(envVar)
    }
  }

  if (missingVars.length > 0) {
    console.error("❌ Missing required environment variables in .env:")
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`)
    })
    console.error("\n📝 Please check your .env file and add the missing variables.")
    console.error("💡 You can use .env.example as a template.")
    throw new Error("Missing required environment variables in .env")
  }

  console.log("✅ All required environment variables are present")
}

// Configurações exportadas
export const config = {
  // Servidor
  port: Number.parseInt(process.env.PORT || "4001", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Mercado Pago
  mercadoPago: {
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
    publicKey: process.env.MERCADO_PAGO_PUBLIC_KEY,
  },

  // Email SMTP
  smtp: {
    host: process.env.SMTP_HOST!,
    port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  },

  // Emails de notificação
  emails: {
    notify: process.env.NOTIFY_EMAIL!,
    additionalNotify: process.env.ADDITIONAL_NOTIFY_EMAIL || "sarahmarry.loja@gmail.com",
    from: process.env.FROM_EMAIL!,
    fromName: process.env.FROM_NAME || "Tutty Pijamas",
  },

  // Melhor Envio
  melhorEnvio: {
    token: process.env.MELHOR_ENVIO_TOKEN,
    sandbox: process.env.MELHOR_ENVIO_SANDBOX === "true",
  },

  // CORS
  frontendUrl: process.env.FRONTEND_URL!,

  // Segurança
  jwtSecret: process.env.JWT_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY,

  // Webhook
  webhookSecret: process.env.WEBHOOK_SECRET,

  // Logs
  log: {
    level: process.env.LOG_LEVEL || "info",
    file: process.env.LOG_FILE || "logs/app.log",
  },
}

// Validar na inicialização
validateEnvVars()
