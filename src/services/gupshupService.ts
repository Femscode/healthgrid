/**
 * Enhanced Gupshup Service for WhatsApp AI Triage Integration
 * Handles all WhatsApp interactions through Gupshup API
 * Supports text, interactive messages, and rich media for medical triage
 */
export class GupshupService {
  private baseUrl = 'https://api.gupshup.io/sm/api/v1'
  private apiKey: string
  private sourceNumber: string
  private appName: string
  private headers: Record<string, string>
  private messageTemplates: any

  constructor(apiKey: string, sourceNumber: string) {
    if (!apiKey || !sourceNumber) {
      throw new Error('Gupshup API key and source number are required')
    }
    
    this.apiKey = apiKey
    this.sourceNumber = sourceNumber
    this.appName = 'HealthGrid'
    
    this.headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': this.apiKey
    }

    this.messageTemplates = this.initializeTemplates()
  }

  private initializeTemplates() {
    return {
      welcome: {
        en: "🏥 Welcome to HealthGrid!\n\nI'm your AI health assistant. I can help assess your symptoms and connect you with healthcare providers.\n\nTo get started, please tell me how you're feeling today.",
        pcm: "🏥 Welcome to HealthGrid!\n\nI be your AI health helper. I fit help you check your sickness and connect you with doctor.\n\nMake you tell me how your body dey today.",
        yo: "🏥 Káàbọ̀ sí HealthGrid!\n\nÈmi ni olùrànlọ́wọ́ ìlera rẹ. Mo lè ràn ọ́ lọ́wọ́ láti ṣàyẹ̀wò àwọn àmì àìsàn rẹ.\n\nLáti bẹ̀rẹ̀, sọ fún mi bí ara rẹ ṣe wà lónìí.",
        ha: "🏥 Maraba da zuwa HealthGrid!\n\nNi ne mai taimakon lafiya. Zan iya taimaka maka duba alamun ciwonka.\n\nDomin mu fara, gaya mani yadda jikinka yake a yau.",
        ig: "🏥 Nnọọ na HealthGrid!\n\nAbụ m onye inyeaka ahụike gị. Enwere m ike inyere gị aka chọpụta ihe na-eme gị.\n\nIji malite, gwa m otú ahụ gị dị taa."
      },
      
      languageSelection: {
        text: "🌍 Please select your preferred language / Abeg choose your language",
        buttons: [
          { id: "lang_en", title: "English" },
          { id: "lang_pcm", title: "Pidgin" },
          { id: "lang_yo", title: "Yoruba" },
          { id: "lang_ha", title: "Hausa" },
          { id: "lang_ig", title: "Igbo" }
        ]
      },

      emergency: {
        en: "🚨 EMERGENCY DETECTED\n\nBased on your symptoms, you need immediate medical attention.\n\n📞 Call emergency services: 199 or 112\n🏥 Go to the nearest hospital immediately\n\nDo you need help finding nearby hospitals?",
        pcm: "🚨 EMERGENCY!\n\nFrom wetin you talk, you need doctor quick quick.\n\n📞 Call emergency: 199 or 112\n🏥 Go hospital now now\n\nYou wan make I help you find hospital for your area?",
        yo: "🚨 ÌPAYÀ!\n\nLáti inú àwọn àmì tí o sọ, o nílò ìtọ́jú dókítà lẹ́sẹ̀kẹsẹ̀.\n\n📞 Pe ìpayà: 199 tàbí 112\n🏥 Lọ sí ilé ìwòsàn tí ó sún mọ́ ọ lẹ́sẹ̀kẹsẹ̀\n\nṢé o fẹ́ kí n ràn ọ́ lọ́wọ́ láti wá ilé ìwòsàn?",
        ha: "🚨 GAGGAWA!\n\nDaga alamun da ka bayar, kana bukatar taimakon likita nan take.\n\n📞 Kira gaggawa: 199 ko 112\n🏥 Je asibiti nan take\n\nKana son in taimake ka nemo asibiti a yankinki?",
        ig: "🚨 IHERE!\n\nSite na ihe ị gwara m, ịchọrọ nlekọta dọkịta ozugbo.\n\n📞 Kpọọ ihere: 199 ma ọ bụ 112\n🏥 Gaa ụlọ ọgwụ dị nso ozugbo\n\nỊ chọrọ ka m nyere gị aka chọta ụlọ ọgwụ dị nso?"
      }
    }
  }

  async sendTextMessage(phoneNumber: string, message: string, options: any = {}): Promise<any> {
    try {
      const payload = {
        channel: 'whatsapp',
        source: this.sourceNumber,
        destination: phoneNumber,
        message: JSON.stringify({
          type: 'text',
          text: message
        }),
        'src.name': this.appName
      }

      if (options.isHSM) {
        payload['isHSM'] = 'true'
      }

      const response = await this._makeRequest('/msg', payload)
      
      console.log('Text message sent successfully', {
        phoneNumber,
        messageLength: message.length,
        messageId: response.messageId
      })

      return response
    } catch (error) {
      console.error('Failed to send text message', { phoneNumber, error: error.message })
      throw new Error(`WhatsApp message delivery failed: ${error.message}`)
    }
  }

  async sendInteractiveButtons(phoneNumber: string, text: string, buttons: any[], options: any = {}): Promise<any> {
    try {
      const formattedButtons = buttons.map((button, index) => ({
        type: 'reply',
        reply: {
          id: button.id || `btn_${index}`,
          title: button.title.substring(0, 20) // WhatsApp limit
        }
      }))

      const interactiveMessage = {
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: text
          },
          action: {
            buttons: formattedButtons
          }
        }
      }

      const payload = {
        channel: 'whatsapp',
        source: this.sourceNumber,
        destination: phoneNumber,
        message: JSON.stringify(interactiveMessage),
        'src.name': this.appName
      }

      const response = await this._makeRequest('/msg', payload)
      
      console.log('Interactive button message sent', {
        phoneNumber,
        buttonCount: buttons.length,
        messageId: response.messageId
      })

      return response
    } catch (error) {
      console.error('Failed to send interactive buttons', { phoneNumber, error: error.message })
      throw error
    }
  }

  async sendListMessage(phoneNumber: string, text: string, buttonText: string, sections: any[]): Promise<any> {
    try {
      const listMessage = {
        type: 'interactive',
        interactive: {
          type: 'list',
          header: {
            type: 'text',
            text: text.substring(0, 60) // WhatsApp limit
          },
          body: {
            text: text
          },
          action: {
            button: buttonText,
            sections: sections.map(section => ({
              title: section.title,
              rows: section.rows.map(row => ({
                id: row.id,
                title: row.title.substring(0, 24), // WhatsApp limit
                description: row.description?.substring(0, 72) // WhatsApp limit
              }))
            }))
          }
        }
      }

      const payload = {
        channel: 'whatsapp',
        source: this.sourceNumber,
        destination: phoneNumber,
        message: JSON.stringify(listMessage),
        'src.name': this.appName
      }

      const response = await this._makeRequest('/msg', payload)
      
      console.log('List message sent', {
        phoneNumber,
        sectionCount: sections.length,
        messageId: response.messageId
      })

      return response
    } catch (error) {
      console.error('Failed to send list message', { phoneNumber, error: error.message })
      throw error
    }
  }

  async sendWelcomeMessage(phoneNumber: string): Promise<any> {
    const template = this.messageTemplates.languageSelection
    return await this.sendInteractiveButtons(
      phoneNumber,
      template.text,
      template.buttons
    )
  }

  async sendEmergencyAlert(phoneNumber: string, language: string = 'en'): Promise<any> {
    const message = this.messageTemplates.emergency[language] || this.messageTemplates.emergency.en
    
    const buttons = [
      { id: 'find_hospitals', title: '🏥 Find Hospitals' },
      { id: 'call_emergency', title: '📞 Call 199' }
    ]

    return await this.sendInteractiveButtons(phoneNumber, message, buttons)
  }

  async sendTriageResults(phoneNumber: string, triageResult: any, language: string = 'en'): Promise<any> {
    const { severity, recommendedAction, likelyConditions, providers } = triageResult
    
    let message = this._formatTriageMessage(triageResult, language)
    
    if (providers && providers.length > 0) {
      const sections = [{
        title: "Recommended Providers",
        rows: providers.slice(0, 10).map((provider: any, index: number) => ({
          id: `provider_${provider.id}`,
          title: provider.name,
          description: `${provider.specialty} • ${provider.distance} • ⭐ ${provider.rating}`
        }))
      }]

      return await this.sendListMessage(
        phoneNumber,
        message,
        "Select Provider",
        sections
      )
    } else {
      return await this.sendTextMessage(phoneNumber, message)
    }
  }

  private _formatTriageMessage(triageResult: any, language: string): string {
    const { severity, recommendedAction, likelyConditions } = triageResult
    
    let message = "📋 **Triage Assessment Results**\n\n"
    
    const severityEmojis: Record<string, string> = {
      'EMERGENCY': '🚨',
      'URGENT': '⚠️',
      'MODERATE': '⚡',
      'MILD': '💙',
      'ROUTINE': '✅'
    }
    
    message += `${severityEmojis[severity] || '📊'} **Severity:** ${severity}\n\n`
    
    if (likelyConditions && likelyConditions.length > 0) {
      message += "🔍 **Possible Conditions:**\n"
      likelyConditions.slice(0, 3).forEach((condition: any) => {
        const confidence = Math.round(condition.confidence * 100)
        message += `• ${condition.name} (${confidence}% match)\n`
      })
      message += "\n"
    }
    
    message += `💡 **Recommended Action:**\n${recommendedAction}\n\n`
    message += "⚠️ *This is an AI assessment. Please consult a healthcare provider for proper diagnosis and treatment.*"
    
    return message
  }

  parseIncomingMessage(payload: any): any {
    try {
      const messageData = {
        messageId: payload.id,
        timestamp: payload.timestamp,
        phoneNumber: payload.payload?.sender?.phone || payload.mobile,
        messageType: payload.payload?.type || payload.type,
        content: null,
        isButtonReply: false,
        isListReply: false
      }

      switch (messageData.messageType) {
        case 'text':
          messageData.content = payload.payload?.text || payload.text
          break
          
        case 'button_reply':
          messageData.content = payload.payload?.title
          messageData['buttonId'] = payload.payload?.id
          messageData.isButtonReply = true
          break
          
        case 'list_reply':
          messageData.content = payload.payload?.title
          messageData['listId'] = payload.payload?.id
          messageData.isListReply = true
          break
          
        case 'image':
        case 'document':
        case 'audio':
          messageData.content = payload.payload?.caption || 'Media received'
          messageData['mediaUrl'] = payload.payload?.url
          break
          
        default:
          messageData.content = 'Unsupported message type'
      }

      console.log('Parsed incoming message', messageData)
      return messageData
      
    } catch (error) {
      console.error('Failed to parse incoming message', { payload, error: error.message })
      return null
    }
  }

  private async _makeRequest(endpoint: string, payload: any): Promise<any> {
    try {
      const url = `${this.baseUrl}${endpoint}`
      const formData = new URLSearchParams(payload)
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: formData.toString()
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.status === 'submitted' || data.status === 'success') {
        return data
      } else {
        throw new Error(`Gupshup API error: ${data.message || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Gupshup API error', {
        endpoint,
        error: error.message
      })
      throw new Error(`Gupshup API communication failed: ${error.message}`)
    }
  }

  getTemplate(templateKey: string, language: string = 'en'): string | null {
    const template = this.messageTemplates[templateKey]
    if (!template) {
      console.warn('Template not found', { templateKey, language })
      return null
    }
    
    return template[language] || template.en || template
  }
}