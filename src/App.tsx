import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Heart, Stethoscope, User, Bot } from 'lucide-react';
import { cn } from './lib/utils';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

const API_CONFIG = {
  BASE_URL: 'https://healthgrid-backend.syncosave.com',
  ENDPOINTS: {
    HEALTH_CHECK: '/health',
    CREATE_SESSION: '/api/chat/sessions',
    SEND_MESSAGE: '/api/chat/sessions/{sessionId}/ai-chat',
    GET_MESSAGES: '/api/chat/sessions/{sessionId}/messages'
  }
};

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I\'m your AI medical assistant that speaks your language. I can help you with health questions, symptoms assessment, provide medical guidance, and connect you to a medical practitioner. How can I assist you today?',
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize session on component mount
    initializeSession();
  }, []);

  const initializeSession = async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CREATE_SESSION}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ language: 'en' })
      });
      
      const data = await response.json();
      if (data.success && data.sessionId) {
        setSessionId(data.sessionId);
      }
    } catch (error) {
      console.error('Failed to initialize session:', error);
      // Continue with demo mode if API is not available
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      if (sessionId) {
        // Send to actual API
        const response = await fetch(
          `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SEND_MESSAGE.replace('{sessionId}', sessionId)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message: inputValue })
          }
        );

        const data = await response.json();
        if (data.success && data.ai_response) {
          const assistantMessage: Message = {
            id: data.message_id || Date.now().toString(),
            content: data.ai_response,
            sender: 'assistant',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          throw new Error('API response failed');
        }
      } else {
        // Demo mode - simulate AI response
        setTimeout(() => {
          const demoResponses = [
            "I understand your concern. Based on what you've described, I'd recommend consulting with a healthcare professional for a proper evaluation. In the meantime, here are some general suggestions...",
            "Thank you for sharing those symptoms with me. While I can provide general guidance, it's important to note that I cannot replace professional medical advice. Here's what I can tell you...",
            "I appreciate you reaching out about your health concerns. Let me provide some general information that might be helpful, but please remember to consult with a doctor for personalized medical advice...",
            "Based on the information you've provided, here are some general recommendations. However, I strongly encourage you to speak with a healthcare provider for a proper assessment..."
          ];
          
          const randomResponse = demoResponses[Math.floor(Math.random() * demoResponses.length)];
          
          const assistantMessage: Message = {
            id: Date.now().toString(),
            content: randomResponse,
            sender: 'assistant',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, assistantMessage]);
          setIsLoading(false);
        }, 1500);
        return;
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Fallback to demo response on error
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: "I'm sorry, I'm having trouble connecting to the server right now. Please try again later or contact support if the issue persists.",
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue]);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
           <img src="/health-grid-logo.png" alt="HealthGrid" className="w-20 h-25 text-white" />
            {/* <Stethoscope className="w-5 h-5 text-white" /> */}
         
          <div>
            <h1 className="text-lg font-semibold text-gray-900">HealthGrid AI</h1>
            <p className="text-sm text-gray-500">Medical Assistant</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-green-600">
            <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Online</span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "chat-message",
                message.sender === 'user' ? 'user-message' : 'assistant-message'
              )}
            >
              <div className="flex space-x-4">
                <div className="flex-shrink-0">
                  {message.sender === 'user' ? (
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="message-content">
                    <p className="text-gray-900 whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="chat-message assistant-message">
              <div className="flex space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="typing-indicator">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white px-4 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Describe your symptoms or ask a health question..."
                  className="w-full resize-none border border-gray-300 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500 text-center">
            This is an AI assistant by HealthGrid. It provides general health information and connect you to a medical practitioner if needed.
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;