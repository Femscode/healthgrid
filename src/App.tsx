import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';


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
      content: "Hello! I'm your AI health assistant. I can answer health questions, check symptoms, give guidance, and connect you with a doctor. I also speak Pidgen, Hausa, Igbo, and Yoruba. How can I help you today?",
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

  const hasMessages = messages.length > 1; // More than just the initial greeting

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="bg-gradient-to-br from-blue-500 to-green-500 rounded-2xl p-0 shadow-lg">
            <img src="/health-grid-logo.png" alt="HealthGrid" className="w-20 h-20 object-contain filter brightness-0 invert" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">HealthGrid AI</h1>
            <p className="text-gray-600 text-sm font-medium">Your Intelligent Medical Assistant</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-green-700">Online</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {!hasMessages ? (
          /* Centered Welcome Screen */
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <div className="text-center mb-12 max-w-2xl">
              <div className="mb-8">
               
                <h2 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2 mt-2">Welcome to HealthGrid</h2>
                <p className="text-gray-600 text-sm leading-relaxed">Your intelligent medical assistant ready to help and connect you to a medical practitioner.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-6 text-left hover:shadow-lg transition-all duration-200">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Ask Health Questions</h3>
                  <p className="text-gray-600 text-sm">Get reliable information about symptoms, conditions, and general health topics.</p>
                </div>
                
                <div className="bg-white/60 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-6 text-left hover:shadow-lg transition-all duration-200">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-2-2V10a2 2 0 012-2h2m2-4h6a2 2 0 012 2v6a2 2 0 01-2 2h-6l-4 4V8a2 2 0 012-2z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Multilingual Support</h3>
                  <p className="text-gray-600 text-sm">Communicate in English, Pidgin, Hausa, Igbo, and Yoruba languages.</p>
                </div>
              </div>
            </div>
            
            {/* Centered Input */}
            <div className="w-full max-w-3xl">
              <div className="bg-white/80 backdrop-blur-md border border-gray-200/50 rounded-2xl shadow-xl p-6">
                <div className="flex space-x-4">
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask me anything about your health..."
                      className="w-full resize-none border-0 bg-transparent text-gray-900 placeholder-gray-500 focus:outline-none text-lg leading-relaxed"
                      rows={1}
                      disabled={isLoading}
                    />
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="p-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl flex-shrink-0"
                  >
                    <Send className="w-6 h-6" />
                  </button>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500">HealthGrid AI provides general health information. Always consult healthcare professionals for medical advice.</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Chat Messages View */
          <>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto space-y-6">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-2xl px-6 py-4 rounded-3xl shadow-sm ${
                        message.sender === 'user'
                          ? 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-900'
                          : 'bg-white/80 backdrop-blur-sm border border-gray-200/50 text-gray-900 shadow-lg'
                      }`}
                    >
                      <div className="message-content">
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      </div>
                      <div className={`text-xs mt-3 ${
                        message.sender === 'user' ? 'text-dark-100' : 'text-gray-500'
                      }`}>
                       {message.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="max-w-xs lg:max-w-2xl px-6 py-4 rounded-3xl bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-lg">
                      <div className="flex items-center space-x-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                        <span className="text-gray-700 font-medium">AI is analyzing...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
            
            {/* Bottom Input */}
            <div className="bg-white/80 backdrop-blur-md border-t border-gray-200/50 p-6 shadow-lg">
              <div className="max-w-4xl mx-auto">
                <div className="flex space-x-4">
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask me anything about your health..."
                      className="w-full resize-none border-2 border-gray-200 rounded-2xl px-6 py-4 pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 placeholder-gray-500 bg-white/50 backdrop-blur-sm"
                      rows={1}
                      disabled={isLoading}
                    />
                    <div className="absolute right-16 top-1/2 transform -translate-y-1/2">
                      <div className="w-6 h-6 text-gray-400">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                        </svg>
                      </div>
                    </div>
                    <button
                      onClick={sendMessage}
                      disabled={!inputValue.trim() || isLoading}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 text-center">
                  <p className="text-xs text-gray-500">HealthGrid AI provides general health information, and also connect you to a healthcare professional for medical support.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;