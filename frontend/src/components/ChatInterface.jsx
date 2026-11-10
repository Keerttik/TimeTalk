import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, RefreshCw, HelpCircle } from 'lucide-react';
import { QUICK_PROMPTS } from '../mockData';

export default function ChatInterface({
  messages,
  onSendMessage,
  onSelectClarification,
  isLoading,
  onResetSession
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleChipClick = (promptText) => {
    if (isLoading) return;
    setInput(promptText);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 leading-none">TimeTalk Copilot</h2>
            <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Grounded in Northwind Catalogue
            </span>
          </div>
        </div>

        {onResetSession && (
          <button
            onClick={onResetSession}
            title="Reset Conversation & Demo State"
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 px-2 py-1 rounded transition cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Reset Demo
          </button>
        )}
      </div>

      {/* Quick-Test Prompts Carousel / Chips */}
      <div className="px-3 py-2 bg-slate-50/70 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
        <span className="text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-blue-500" />
          Test Chips:
        </span>
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp.id}
            onClick={() => handleChipClick(qp.text)}
            className="shrink-0 text-[11px] bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-medium px-2.5 py-1 rounded-md border border-slate-200 hover:border-blue-300 shadow-2xs transition cursor-pointer"
          >
            <span className="font-semibold text-blue-600 mr-1">{qp.tag}:</span>
            {qp.text.length > 40 ? qp.text.substring(0, 40) + '...' : qp.text}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {messages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={index}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  className={`p-3 rounded-xl text-xs leading-relaxed shadow-2xs ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-br-xs'
                      : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Clarification Options */}
                  {msg.clarificationOptions && msg.clarificationOptions.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200">
                      <span className="text-[11px] font-semibold text-slate-600 block mb-1.5 flex items-center gap-1">
                        <HelpCircle className="w-3 h-3 text-amber-500" />
                        Select matched project:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.clarificationOptions.map((opt, optIdx) => (
                          <button
                            key={optIdx}
                            onClick={() => onSelectClarification(opt, msg)}
                            className="bg-white hover:bg-blue-600 text-blue-700 hover:text-white font-semibold text-[11px] px-2.5 py-1.5 rounded-lg border border-blue-300 shadow-2xs transition cursor-pointer"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 mt-1 px-1">
                  {msg.timestamp || 'Just now'}
                </span>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-100 px-4 py-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></div>
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-.3s]"></div>
              <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-.5s]"></div>
              <span className="text-xs text-slate-500 ml-1">Analyzing work activities...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., Spent 3 hours on Acme design review yesterday..."
            disabled={isLoading}
            className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}

