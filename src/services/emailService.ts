import nodemailer from "nodemailer"
// CORREÇÃO: Caminho correto para o emailLogger
import { emailLogger } from "../middleware/emailLogger"

// Interfaces para tipagem
interface EmailResult {
  success: boolean
  messageId?: string
  recipient?: string
  type: string
  error?: string
}

interface EmailResults {
  admin: EmailResult | null
  customer: EmailResult | null
  success: boolean
  errors: string[]
}

interface OrderPayload {
  customerData?: {
    name: string
    email: string
    cpf: string
    cpfFormatted: string
    address: {
      cep: string
      cepFormatted: string
      street: string
      number: string
      complement: string
      neighborhood: string
      city: string
      state: string
      fullAddress: string
    }
  }
  orderSummary?: {
    subtotal: number
    subtotalFormatted: string
    shippingCost: number
    shippingCostFormatted: string
    totalAmount: number
    totalAmountFormatted: string
    itemsCount: number
    itemsDetails: Array<{
      name: string
      size: string
      quantity: number
      unitPrice: number
      unitPriceFormatted: string
      totalPrice: number
      totalPriceFormatted: string
    }>
  }
  shippingDetails?: {
    company: string
    service: string
    cost: number
    costFormatted: string
    deliveryTime: string
    deliveryTimeMin: number
    deliveryTimeMax: number
    melhorEnvioId: number
    discount: number
    discountFormatted: string
  }
  orderMetadata?: {
    timestamp: string
    timestampFormatted: string
    userAgent: string
    platform: string
    language: string
  }
  emailNotification?: {
    sendToAdmin?: boolean
    sendToCustomer?: boolean
    adminEmailHTML?: string
    customerEmailHTML?: string
  }
  // Campos legados para compatibilidade
  customerName?: string
  customerEmail?: string
  customerCPF?: string
  items?: Array<{
    id: string
    name: string
    price: number
    quantity: number
    size: string
  }>
  shipping?: {
    method: string
    service: string
    deliveryTime: string
  }
  totalAmount?: number
  shippingCost?: number
  address?: {
    street: string
    number: string
    complement: string
    neighborhood: string
    city: string
    state: string
    cep: string
  }
}

class EmailService {
  private transporter: nodemailer.Transporter

  constructor() {
    // Configuração do transporter do nodemailer
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    console.log("📧 EmailService inicializado com configurações:")
    console.log("- Email User:", process.env.SMTP_USER ? "✅ Configurado" : "❌ Não configurado")
    console.log("- Email Pass:", process.env.SMTP_PASS ? "✅ Configurado" : "❌ Não configurado")
    console.log("- Notify Email:", process.env.NOTIFY_EMAIL ? "✅ Configurado" : "❌ Não configurado")
  }

  // Enviar email para admin usando template do frontend
  async sendAdminNotification(orderPayload: OrderPayload): Promise<EmailResult> {
    try {
      const notifyEmail = process.env.NOTIFY_EMAIL
      if (!notifyEmail) {
        throw new Error("NOTIFY_EMAIL não configurado no .env")
      }

      console.log(`📧 Enviando email de notificação para admin: ${notifyEmail}`)

      // Usar o template HTML gerado no frontend
      const adminEmailHTML =
        orderPayload.emailNotification?.adminEmailHTML || this.generateOrderEmailTemplate(orderPayload)

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: notifyEmail,
        subject: `🛍️ Novo Pedido - ${orderPayload.customerData?.name || orderPayload.customerName}`,
        html: adminEmailHTML,
      }

      const result = await this.transporter.sendMail(mailOptions)

      const emailResult: EmailResult = {
        success: true,
        messageId: result.messageId,
        recipient: notifyEmail,
        type: "admin_notification",
      }

      // Log do email enviado
      emailLogger.logEmailSent(orderPayload, emailResult)
      console.log("✅ Email de notificação admin enviado com sucesso:", result.messageId)

      return emailResult
    } catch (error) {
      const emailResult: EmailResult = {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
        type: "admin_notification",
      }

      // Log do erro
      emailLogger.logEmailSent(orderPayload, emailResult)
      console.error("❌ Erro ao enviar email de notificação admin:", error)

      return emailResult
    }
  }

  // Enviar email de confirmação para cliente
  async sendCustomerConfirmation(orderPayload: OrderPayload): Promise<EmailResult> {
    try {
      const customerEmail = orderPayload.customerData?.email || orderPayload.customerEmail
      if (!customerEmail) {
        throw new Error("Email do cliente não encontrado")
      }

      console.log(`📧 Enviando confirmação para cliente: ${customerEmail}`)

      // Usar o template HTML gerado no frontend
      const customerEmailHTML =
        orderPayload.emailNotification?.customerEmailHTML || this.generateCustomerConfirmationTemplate(orderPayload)

      const mailOptions = {
        from: process.env.SMTP_USER,
        to: customerEmail,
        subject: `✅ Confirmação do seu pedido`,
        html: customerEmailHTML,
      }

      const result = await this.transporter.sendMail(mailOptions)

      const emailResult: EmailResult = {
        success: true,
        messageId: result.messageId,
        recipient: customerEmail,
        type: "customer_confirmation",
      }

      // Log do email enviado
      emailLogger.logEmailSent(orderPayload, emailResult)
      console.log("✅ Email de confirmação cliente enviado com sucesso:", result.messageId)

      return emailResult
    } catch (error) {
      const emailResult: EmailResult = {
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
        type: "customer_confirmation",
      }

      // Log do erro
      emailLogger.logEmailSent(orderPayload, emailResult)
      console.error("❌ Erro ao enviar email de confirmação cliente:", error)

      return emailResult
    }
  }

  // Enviar ambos os emails (admin + cliente)
  async sendOrderEmails(orderPayload: OrderPayload): Promise<EmailResults> {
    console.log("📧 Iniciando envio de emails do pedido...")

    const results: EmailResults = {
      admin: null,
      customer: null,
      success: false,
      errors: [],
    }

    try {
      // Verificar se deve enviar emails
      const emailConfig = orderPayload.emailNotification || {}

      // Enviar email para admin
      if (emailConfig.sendToAdmin !== false) {
        results.admin = await this.sendAdminNotification(orderPayload)
        if (!results.admin.success) {
          results.errors.push(`Admin: ${results.admin.error}`)
        }
      }

      // Enviar email para cliente
      if (emailConfig.sendToCustomer !== false) {
        results.customer = await this.sendCustomerConfirmation(orderPayload)
        if (!results.customer.success) {
          results.errors.push(`Cliente: ${results.customer.error}`)
        }
      }

      // Determinar sucesso geral
      const adminSuccess = !results.admin || results.admin.success
      const customerSuccess = !results.customer || results.customer.success
      results.success = adminSuccess && customerSuccess

      if (results.success) {
        console.log("✅ Todos os emails foram enviados com sucesso!")
      } else {
        console.log("⚠️ Alguns emails falharam:", results.errors)
      }

      return results
    } catch (error) {
      console.error("❌ Erro geral no envio de emails:", error)
      results.errors.push(`Erro geral: ${error instanceof Error ? error.message : "Erro desconhecido"}`)
      return results
    }
  }

  // Template de fallback para confirmação do cliente
  private generateCustomerConfirmationTemplate(orderData: OrderPayload): string {
    const customerName = orderData.customerData?.name || orderData.customerName || "Cliente"
    const totalAmount = orderData.totalAmount || orderData.orderSummary?.totalAmount || 0
    const items = orderData.items || []

    const itemsHtml = items
      .map(
        (item) => `
        <div style="padding: 10px; background: white; margin: 5px 0; border-radius: 4px; border-left: 4px solid #28a745;">
          ${item.name} - Tamanho: ${item.size} (${item.quantity}x) = R$ ${(item.price * item.quantity).toFixed(2).replace(".", ",")}
        </div>
      `,
      )
      .join("")

    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>Confirmação do seu Pedido</title>
          <style>
              body { 
                  font-family: Arial, sans-serif; 
                  line-height: 1.6; 
                  color: #333; 
                  margin: 0; 
                  padding: 0; 
                  background-color: #f5f5f5;
              }
              .container { 
                  max-width: 600px; 
                  margin: 0 auto; 
                  padding: 20px; 
                  background-color: white;
                  box-shadow: 0 0 10px rgba(0,0,0,0.1);
              }
              .header { 
                  background: linear-gradient(135deg, #28a745 0%, #20c997 100%); 
                  color: white;
                  padding: 30px 20px; 
                  text-align: center; 
                  border-radius: 8px 8px 0 0; 
                  margin: -20px -20px 20px -20px;
              }
              .header h1 { margin: 0; font-size: 28px; }
              .section { 
                  margin: 25px 0; 
                  padding: 20px; 
                  border: 1px solid #e9ecef; 
                  border-radius: 8px; 
                  background: #fafafa;
              }
              .total { 
                  font-weight: bold; 
                  font-size: 20px; 
                  color: #28a745; 
                  text-align: center;
                  padding: 15px;
                  background: #d4edda;
                  border-radius: 8px;
                  margin: 15px 0;
              }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>✅ Pedido Confirmado!</h1>
                  <p style="margin: 10px 0 0 0; font-size: 16px;">
                      Olá, ${customerName}!
                  </p>
              </div>

              <div class="section">
                  <h2>🎉 Seu pedido foi recebido com sucesso!</h2>
                  <p>Obrigado por sua compra! Seu pedido está sendo processado e você receberá atualizações sobre o status da entrega.</p>
                  
                  <div class="total">
                      💳 VALOR TOTAL: R$ ${totalAmount.toFixed(2).replace(".", ",")}
                  </div>

                  <p><strong>📦 Itens do seu pedido:</strong></p>
                  ${itemsHtml}
              </div>

              <div style="text-align: center; padding: 20px; color: #666; font-size: 14px; border-top: 1px solid #eee; margin-top: 30px;">
                  <p>Obrigado por escolher nossa loja!</p>
                  <p>Em caso de dúvidas, entre em contato conosco.</p>
              </div>
          </div>
      </body>
      </html>
    `
  }

  // Template original como fallback para admin
  private generateOrderEmailTemplate(orderData: OrderPayload): string {
    const {
      customerData,
      items,
      shipping,
      totalAmount,
      shippingCost,
      customerName,
      customerEmail,
      customerCPF,
      address,
    } = orderData

    // Usar dados da nova estrutura ou fallback para estrutura antiga
    const name = customerData?.name || customerName || "Cliente"
    const email = customerData?.email || customerEmail || "N/A"
    const cpf = customerData?.cpfFormatted || customerCPF || "N/A"
    const addr = customerData?.address || address

    if (!items || items.length === 0) {
      return "<p>Erro: Nenhum item encontrado no pedido</p>"
    }

    const itemsHtml = items
      .map(
        (item) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; border-right: 1px solid #eee;">
          <strong>${item.name}</strong><br>
          <small style="color: #666;">Tamanho: ${item.size}</small>
        </td>
        <td style="padding: 12px; text-align: center; border-right: 1px solid #eee;">
          ${item.quantity}
        </td>
        <td style="padding: 12px; text-align: right; border-right: 1px solid #eee;">
          R$ ${item.price.toFixed(2).replace(".", ",")}
        </td>
        <td style="padding: 12px; text-align: right; font-weight: bold;">
          R$ ${(item.price * item.quantity).toFixed(2).replace(".", ",")}
        </td>
      </tr>
    `,
      )
      .join("")

    const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0)
    const finalShippingCost = shippingCost || 0
    const finalTotalAmount = totalAmount || subtotal + finalShippingCost

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Nova Compra Realizada</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: white; padding: 30px; border: 1px solid #ddd; }
          .section { margin-bottom: 30px; }
          .section h3 { color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 15px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
          .info-item { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; }
          .info-label { font-weight: bold; color: #555; margin-bottom: 5px; }
          .info-value { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #667eea; color: white; padding: 12px; text-align: left; }
          .total-section { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 20px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .total-final { font-size: 1.2em; font-weight: bold; color: #667eea; border-top: 2px solid #667eea; padding-top: 10px; }
          .alert { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 8px; margin-top: 20px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛍️ Nova Compra Realizada!</h1>
            <p>Um novo pedido foi realizado em sua loja</p>
          </div>
                    
          <div class="content">
            <!-- Dados do Cliente -->
            <div class="section">
              <h3>👤 Dados do Cliente</h3>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Nome Completo:</div>
                  <div class="info-value">${name}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Email:</div>
                  <div class="info-value">${email}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">CPF:</div>
                  <div class="info-value">${cpf}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Data do Pedido:</div>
                  <div class="info-value">${new Date().toLocaleString("pt-BR")}</div>
                </div>
              </div>
            </div>

            <!-- Endereço de Entrega -->
            ${
              addr
                ? `
            <div class="section">
              <h3>📍 Endereço de Entrega</h3>
              <div class="info-item">
                <div class="info-label">Endereço Completo:</div>
                <div class="info-value">
                  ${addr.street}, ${addr.number}${addr.complement ? ` - ${addr.complement}` : ""}<br>
                  ${addr.neighborhood} - ${addr.city}/${addr.state}<br>
                  CEP: ${addr.cep}
                </div>
              </div>
            </div>
            `
                : ""
            }

            <!-- Produtos -->
            <div class="section">
              <h3>🛒 Produtos Comprados</h3>
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th style="text-align: center;">Qtd</th>
                    <th style="text-align: right;">Preço Unit.</th>
                    <th style="text-align: right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>
            </div>

            <!-- Resumo Financeiro -->
            <div class="section">
              <h3>💰 Resumo Financeiro</h3>
              <div class="total-section">
                <div class="total-row">
                  <span>Subtotal dos Produtos:</span>
                  <span>R$ ${subtotal.toFixed(2).replace(".", ",")}</span>
                </div>
                <div class="total-row">
                  <span>Frete:</span>
                  <span>R$ ${finalShippingCost.toFixed(2).replace(".", ",")}</span>
                </div>
                <div class="total-row total-final">
                  <span>TOTAL DO PEDIDO:</span>
                  <span>R$ ${finalTotalAmount.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
            </div>

            <div class="alert">
              <strong>⚠️ Ação Necessária:</strong> Um novo pedido foi realizado e está aguardando processamento. 
              Verifique o sistema de pagamentos para confirmar o status da transação.
            </div>
          </div>

          <div class="footer">
            <p>Este email foi enviado automaticamente pelo sistema da loja.</p>
            <p>Data/Hora: ${new Date().toLocaleString("pt-BR")}</p>
          </div>
        </div>
      </body>
      </html>
    `
  }

  // Método para testar configuração de email
  async testEmailConfiguration(): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const testEmail = {
        from: process.env.SMTP_USER,
        to: process.env.NOTIFY_EMAIL,
        subject: "✅ Teste de Configuração de Email",
        html: `
          <h2>🧪 Teste de Email</h2>
          <p>Se você recebeu este email, a configuração está funcionando corretamente!</p>
          <p><strong>Data/Hora:</strong> ${new Date().toLocaleString("pt-BR")}</p>
          <p><strong>Configurações:</strong></p>
          <ul>
            <li>Email User: ${process.env.SMTP_USER}</li>
            <li>Notify Email: ${process.env.NOTIFY_EMAIL}</li>
          </ul>
        `,
      }

      const result = await this.transporter.sendMail(testEmail)
      console.log("✅ Email de teste enviado com sucesso:", result.messageId)
      return { success: true, messageId: result.messageId }
    } catch (error) {
      console.error("❌ Erro no teste de email:", error)
      return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }
    }
  }

  // Método para obter estatísticas de email
  getEmailStats() {
    return emailLogger.getDetailedStats()
  }

  // Método para obter logs recentes
  getRecentEmailLogs(limit = 10) {
    return emailLogger.getRecentLogs(limit)
  }

  // Método para limpar logs
  clearEmailLogs() {
    emailLogger.clearLogs()
  }
}

export default new EmailService()
