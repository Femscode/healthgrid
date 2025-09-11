/**
 * WhatsApp Webhook Handler for Gupshup Integration
 * Processes incoming messages and manages conversation flow
 * Handles all WhatsApp message types and user interactions
 */
import { SessionManager } from './sessionManager'
import { ConversationFlowManager } from './conversationFlowManager'
import { GupshupService } from './gupshupService'
import { ChatService } from './chatService'

export class WebhookHandler {
  private sessionManager: SessionManager
  private conversationManager: ConversationFlowManager
  private gupshupService: GupshupService
  private chatService: ChatService
  private metrics: any

  constructor(sessionManager: SessionManager, conversationManager: ConversationFlowManager, gupshupService: GupshupService, chatService: ChatService) {
    this.sessionManager = sessionManager
    this.conversationManager = conversationManager
    this.gupshupService = gupshupService
    this.chatService = chatService
    
    // Track webhook metrics
    this.metrics = {
      totalMessages: 0,
      messagesByType: {},
      errorCount: 0,
      processingTimes: []
    }
  }

  async processWebhook(payload: any): Promise<any> {
    const startTime = Date.now()
    
    try {
      console.log('Incoming webhook', {
        hasPayload: !!payload,
        type: payload?.type
      })

      // Validate webhook payload
      const validationResult = this.validateWebhookPayload(payload)
      if (!validationResult.isValid) {
        console.warn('Invalid webhook payload', { 
          errors: validationResult.errors,
          payload 
        })
        throw new Error(`Invalid payload: ${validationResult.errors.join(', ')}`)
      }

      // Parse the incoming message
      const messageData = this.gupshupService.parseIncomingMessage(payload)
      if (!messageData) {
        console.error('Failed to parse message', { payload })
        throw new Error('Cannot parse message')
      }

      // Update metrics
      this.updateMetrics(messageData)

      // Skip processing for delivery receipts and status updates
      if (this.isStatusMessage(payload)) {
        console.log('Status message received', { messageData })
        return { status: 'ok', message: 'Status processed' }
      }

      // Process the message
      await this.processUserMessage(messageData)

      // Record processing time
      const processingTime = Date.now() - startTime
      this.metrics.processingTimes.push(processingTime)
      
      console.log('Webhook processed successfully', {
        phoneNumber: messageData.phoneNumber,
        messageType: messageData.messageType,
        processingTime: `${processingTime}ms`
      })

      return { 
        status: 'success', 
        messageId: messageData.messageId,
        processingTime: `${processingTime}ms`
      }

    } catch (error) {
      this.metrics.errorCount++
      const processingTime = Date.now() - startTime
      
      console.error('Webhook processing failed', {
        error: error instanceof Error ? error.message : String(error),
        payload,
        processingTime: `${processingTime}ms`
      })

      throw error
    }
  }

  private async processUserMessage(messageData: any): Promise<void> {
    try {
      const { phoneNumber, content, messageType, isButtonReply, isListReply, messageId } = messageData

      // Check if this message has already been processed to prevent duplicates
      if (messageId) {
        const isProcessed = await this.chatService.isMessageProcessed(messageId, phoneNumber)
        if (isProcessed) {
          console.log('Message already processed, skipping', { messageId, phoneNumber })
          return
        }
      }

      // Get or create user session
      const session = await this.sessionManager.getOrCreateSession(phoneNumber)
      
      // Mark message as processed to prevent future duplicates
      if (messageId) {
        await this.chatService.markWebhookMessageProcessed(messageId, phoneNumber, session.id, messageData)
      }

      // Create message object for conversation manager
      const message = {
        original: content,
        phoneNumber: phoneNumber,
        type: messageType,
        isButtonReply,
        isListReply,
        buttonId: messageData.buttonId,
        listId: messageData.listId,
        timestamp: messageData.timestamp
      }

      // Process through conversation flow
      const response = await this.conversationManager.manageConversation(message, session)

      // Send response back to user
      if (response) {
        await this.sendResponse(phoneNumber, response, session)
        
        // Add outgoing message to history
        await this.sessionManager.addToHistory(session.id, {
          content: response.message || 'Interactive message sent',
          type: response.type || 'text',
          timestamp: new Date(),
          metadata: response
        }, 'outgoing')
      }

    } catch (error) {
      console.error('Error processing user message', {
        phoneNumber: messageData.phoneNumber,
        error: error instanceof Error ? error.message : String(error)
      })

      // Send error message to user
      await this.sendErrorMessage(messageData.phoneNumber, error instanceof Error ? error : new Error(String(error)))
    }
  }

  private async sendResponse(phoneNumber: string, response: any, session: any): Promise<void> {
    try {
      const language = session.preferredLanguage || 'en'

      switch (response.type) {
        case 'text':
          await this.gupshupService.sendTextMessage(phoneNumber, response.message)
          break

        case 'interactive':
          if (response.interactive.type === 'button') {
            await this.gupshupService.sendInteractiveButtons(
              phoneNumber,
              response.message,
              response.interactive.buttons
            )
          } else if (response.interactive.type === 'list') {
            await this.gupshupService.sendListMessage(
              phoneNumber,
              response.message,
              response.interactive.buttonText || 'Select Option',
              response.interactive.sections
            )
          }
          break

        case 'welcome':
          await this.gupshupService.sendWelcomeMessage(phoneNumber)
          break

        case 'emergency':
          await this.gupshupService.sendEmergencyAlert(phoneNumber, language)
          break

        case 'triage_results':
          await this.gupshupService.sendTriageResults(phoneNumber, response.data, language)
          break

        default:
          // Fallback to text message
          await this.gupshupService.sendTextMessage(
            phoneNumber,
            response.message || 'I encountered an issue. Please try again.'
          )
      }

      console.log('Response sent successfully', {
        phoneNumber,
        responseType: response.type
      })

    } catch (error) {
      console.error('Failed to send response', {
        phoneNumber,
        responseType: response.type,
        error: error instanceof Error ? error.message : String(error)
      })
      
      // Try to send a simple error message
      try {
        await this.gupshupService.sendTextMessage(
          phoneNumber,
          'Sorry, I encountered a technical issue. Please try again in a moment.'
        )
      } catch (fallbackError) {
        console.error('Failed to send fallback error message', {
          phoneNumber,
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        })
      }
    }
  }

  private async sendErrorMessage(phoneNumber: string, error: Error): Promise<void> {
    try {
      let errorMessage = 'I apologize, but I encountered an error while processing your request. Please try again.'
      
      // Customize error message based on error type
      if (error.message.includes('network') || error.message.includes('timeout')) {
        errorMessage = 'I\'m having trouble connecting right now. Please try again in a moment.'
      } else if (error.message.includes('database')) {
        errorMessage = 'I\'m experiencing technical difficulties. Please try again later.'
      }

      await this.gupshupService.sendTextMessage(phoneNumber, errorMessage)
      
    } catch (sendError) {
      console.error('Failed to send error message', {
        phoneNumber,
        originalError: error instanceof Error ? error.message : String(error),
        sendError: sendError instanceof Error ? sendError.message : String(sendError)
      })
    }
  }

  private validateWebhookPayload(payload: any): { isValid: boolean; errors: string[] } {
    const errors = []

    // Check if payload exists
    if (!payload) {
      errors.push('Empty payload')
      return { isValid: false, errors }
    }

    // Check required fields based on Gupshup webhook format
    if (!payload.type && !payload.payload?.type) {
      errors.push('Missing message type')
    }

    // Check for phone number
    const phoneNumber = payload.payload?.sender?.phone || payload.mobile
    if (!phoneNumber) {
      errors.push('Missing phone number')
    }

    // Validate phone number format (basic check)
    if (phoneNumber && !/^\+?[1-9]\d{1,14}$/.test(phoneNumber)) {
      errors.push('Invalid phone number format')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private isStatusMessage(payload: any): boolean {
    const statusTypes = ['delivered', 'read', 'sent', 'failed', 'enroute']
    return statusTypes.includes(payload.type) || 
           statusTypes.includes(payload.payload?.type)
  }

  private updateMetrics(messageData: any): void {
    this.metrics.totalMessages++
    
    const messageType = messageData.messageType || 'unknown'
    this.metrics.messagesByType[messageType] = 
      (this.metrics.messagesByType[messageType] || 0) + 1
  }

  getMetrics(): any {
    const processingTimes = this.metrics.processingTimes
    const avgProcessingTime = processingTimes.length > 0 
      ? processingTimes.reduce((a: number, b: number) => a + b, 0) / processingTimes.length 
      : 0

    return {
      ...this.metrics,
      averageProcessingTime: Math.round(avgProcessingTime),
      timestamp: new Date().toISOString()
    }
  }

  resetMetrics(): void {
    this.metrics = {
      totalMessages: 0,
      messagesByType: {},
      errorCount: 0,
      processingTimes: []
    }
  }

  healthCheck(): any {
    return {
      status: 'healthy',
      services: {
        sessionManager: this.sessionManager ? 'connected' : 'disconnected',
        conversationManager: this.conversationManager ? 'ready' : 'not ready',
        gupshupService: this.gupshupService ? 'configured' : 'not configured'
      },
      metrics: this.getMetrics(),
      timestamp: new Date().toISOString()
    }
  }
}