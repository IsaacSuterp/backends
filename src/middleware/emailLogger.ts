// Vamos criar o emailLogger na estrutura correta
// Este arquivo deve estar em: backend/src/middleware/emailLogger.ts

interface EmailResult {
  success: boolean
  messageId?: string
  recipient?: string
  type: string
  error?: string
}

interface LogEntry {
  timestamp: string
  orderData: any
  emailResult: EmailResult
  status: "success" | "error"
}

class EmailLogger {
  private logs: LogEntry[] = []

  logEmailSent(orderData: any, emailResult: EmailResult): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      orderData: {
        customerName: orderData.customerData?.name || orderData.customerName,
        customerEmail: orderData.customerData?.email || orderData.customerEmail,
        totalAmount: orderData.totalAmount || orderData.orderSummary?.totalAmount,
        itemsCount: orderData.items?.length || orderData.orderSummary?.itemsCount,
      },
      emailResult,
      status: emailResult.success ? "success" : "error",
    }

    this.logs.push(logEntry)

    // Log no console
    if (emailResult.success) {
      console.log(`📧 [${emailResult.type}] Email enviado com sucesso:`, {
        recipient: emailResult.recipient,
        messageId: emailResult.messageId,
        timestamp: logEntry.timestamp,
      })
    } else {
      console.error(`❌ [${emailResult.type}] Falha no envio de email:`, {
        recipient: emailResult.recipient,
        error: emailResult.error,
        timestamp: logEntry.timestamp,
      })
    }

    // Manter apenas os últimos 100 logs em memória
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100)
    }
  }

  getRecentLogs(limit = 10): LogEntry[] {
    return this.logs.slice(-limit).reverse()
  }

  getSuccessRate(): { total: number; success: number; rate: number } {
    const total = this.logs.length
    const success = this.logs.filter((log) => log.status === "success").length
    const rate = total > 0 ? (success / total) * 100 : 0

    return { total, success, rate }
  }

  clearLogs(): void {
    this.logs = []
    console.log("📧 Logs de email limpos")
  }

  // Método para exportar logs como JSON
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  // Método para obter estatísticas detalhadas
  getDetailedStats() {
    const stats = this.getSuccessRate()
    const recentLogs = this.getRecentLogs(5)

    return {
      ...stats,
      recentActivity: recentLogs.map((log) => ({
        timestamp: log.timestamp,
        type: log.emailResult.type,
        success: log.status === "success",
        recipient: log.emailResult.recipient,
      })),
    }
  }
}

export const emailLogger = new EmailLogger()
export default emailLogger
