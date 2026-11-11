import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw, HelpCircle } from 'lucide-react';
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    <div className="flex flex-col h-full min-h-0 bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 leading-tight">TimeTalk Copilot</h2>
            <span className="text-[11px] text-slate-500">
              Grounded in Northwind catalogue
            </span>
          </div>
        </div>

        {onResetSession && (
          <button
            type="button"
            onClick={() => onResetSession()}
            title="Reset demo session"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-[#F7F8FA] border border-slate-200 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Suggestion Chips (Wrapping, No Horizontal Scrollbar) */}
      <div className="px-4 py-2.5 bg-[#F7F8FA] border-b border-slate-200 flex flex-wrap items-center gap-1.5 shrink-0">
        <span className="text-xs font-medium text-slate-500 mr-1">Try:</span>
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp.id}
            type="button"
            onClick={() => handleChipClick(qp.text)}
            title={qp.text}
            className="text-xs bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-medium px-2.5 py-1 rounded-lg border border-slate-200 hover:border-blue-300 transition cursor-pointer"
          >
            {qp.label}
          </button>
        ))}
      </div>

      {/* Message Thread */}
      <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 text-slate-400">
            <Bot className="w-6 h-6 text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-600">Clean workspace ready</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Describe what you worked on below or pick a Try: prompt above.
            </p>
          </div>
        )}
        {messages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={index}
              className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-[#F7F8FA] border border-slate-200 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}

              <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                <div
                  className={`px-3.5 py-2.5 rounded-lg text-xs leading-relaxed ${
                    isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#F7F8FA] text-slate-800 border border-slate-200'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>

                  {/* Clarification Options */}
                  {msg.clarificationOptions && msg.clarificationOptions.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200">
                      <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1 mb-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                        Select matched project:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.clarificationOptions.map((opt, optIdx) => (
                          <button
                            key={optIdx}
                            type="button"
                            onClick={() => onSelectClarification(opt, msg)}
                            className="bg-white hover:bg-blue-600 text-blue-600 hover:text-white font-medium text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 hover:border-blue-600 transition cursor-pointer"
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-slate-400 mt-1 px-0.5">
                  {msg.timestamp || 'Just now'}
                </span>
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-2.5 justify-start items-center">
            <div className="w-7 h-7 rounded-lg bg-[#F7F8FA] border border-slate-200 text-blue-600 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" />
            </div>
            <div className="bg-[#F7F8FA] px-3.5 py-2.5 rounded-lg border border-slate-200 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:-.3s]"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:-.5s]"></div>
              <span className="text-xs text-slate-500 ml-1">Parsing entries...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you worked on..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-xs bg-[#F7F8FA] border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-600/15 focus:border-blue-600 transition"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}
