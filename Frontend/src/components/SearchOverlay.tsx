import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ShieldAlert, Activity, Users, Box, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useBitcoin } from '../context/BitcoinContext';
import { SearchResult } from '../types/bitcoin';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SearchOverlay: React.FC<Props> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { search } = useBitcoin();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchResults = async () => {
      if (query.length < 3) {
        setResults([]);
        return;
      }
      setIsLoading(true);
      const res = await search(query);
      setResults(res);
      setIsLoading(false);
    };

    const debounce = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounce);
  }, [query, search]);

  if (!isOpen) return null;

  const handleSelect = (result: SearchResult) => {
    onClose();
    if (result.type === 'wallet' || result.type === 'address' || result.type === 'entity') {
      navigate(`/bitcoin/wallet/${encodeURIComponent(result.id)}`);
    } else if (result.type === 'transaction') {
      navigate(`/bitcoin/transactions/${encodeURIComponent(result.id)}`);
    } else if (result.type === 'investigation') {
      navigate(`/bitcoin/investigations/${encodeURIComponent(result.id)}`);
    } else {
      navigate(`/bitcoin/wallet/${encodeURIComponent(result.id)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;

      if (results.length > 0) {
        handleSelect(results[0]);
      } else {
        onClose();
        if (/^INV-/i.test(trimmed)) {
          navigate(`/bitcoin/investigations/${encodeURIComponent(trimmed)}`);
        } else if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
          navigate(`/bitcoin/transactions/${encodeURIComponent(trimmed)}`);
        } else {
          navigate(`/bitcoin/wallet/${encodeURIComponent(trimmed)}`);
        }
      }
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'wallet':
      case 'address': return <div className="w-8 h-8 rounded bg-[var(--network-cyan)]/20 flex items-center justify-center text-[var(--network-cyan)]"><Box className="w-4 h-4" /></div>;
      case 'entity': return <div className="w-8 h-8 rounded bg-[var(--behavior-purple)]/20 flex items-center justify-center text-[var(--behavior-purple)]"><Users className="w-4 h-4" /></div>;
      case 'transaction': return <div className="w-8 h-8 rounded bg-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-primary)]"><Activity className="w-4 h-4" /></div>;
      case 'investigation': return <div className="w-8 h-8 rounded bg-[var(--risk-critical)]/20 flex items-center justify-center text-[var(--risk-critical)]"><ShieldAlert className="w-4 h-4" /></div>;
      default: return <Search className="w-4 h-4 text-[var(--text-muted)]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 sm:px-6">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-2xl rounded-2xl overflow-hidden transform transition-all flex flex-col max-h-[80vh]">
        {/* Search Input */}
        <div className="flex items-center p-4 border-b border-[var(--border-subtle)] relative">
          <Search className="w-5 h-5 text-[var(--accent-primary)] absolute left-6" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-none pl-12 pr-10 py-3 text-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:ring-0 focus:outline-none"
            placeholder="Search wallets, addresses, entities, TXIDs..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button 
            onClick={onClose}
            className="absolute right-4 p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Area */}
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {isLoading && query.length >= 3 && (
            <div className="p-8 text-center text-[var(--text-muted)] flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)] mb-4"></div>
              <p>Scanning intelligence database...</p>
            </div>
          )}

          {!isLoading && query.length > 0 && query.length < 3 && (
            <div className="p-8 text-center text-[var(--text-muted)]">
              Type at least 3 characters to search...
            </div>
          )}

          {!isLoading && query.length >= 3 && results.length === 0 && (
            <div className="p-12 text-center flex flex-col items-center">
              <Search className="w-12 h-12 text-[var(--border-strong)] mb-4" />
              <p className="text-[var(--text-primary)] font-medium mb-1">No matches found</p>
              <p className="text-sm text-[var(--text-muted)]">Try searching for a specific Bitcoin address, TXID, or behavioral entity.</p>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Intelligence Results
              </div>
              <ul className="space-y-1">
                {results.map((result, idx) => (
                  <li key={`${result.id}-${idx}`}>
                    <button
                      onClick={() => handleSelect(result)}
                      className="w-full text-left flex items-center gap-4 p-3 rounded-xl hover:bg-[var(--bg-elevated)] border border-transparent hover:border-[var(--border-subtle)] transition-all group"
                    >
                      {getIcon(result.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-[var(--text-primary)] truncate">
                            {result.label}
                          </span>
                          {result.risk && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                              result.risk.includes('CRITICAL') || result.risk.includes('HIGH')
                                ? 'bg-[var(--risk-critical)]/20 text-[var(--risk-critical)]'
                                : 'bg-[var(--success)]/20 text-[var(--success)]'
                            }`}>
                              {result.risk}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] font-mono truncate mt-0.5">
                          {result.type.toUpperCase()} • {result.subLabel || result.id}
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transform group-hover:translate-x-1 transition-all" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] p-3 flex justify-between items-center text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-[var(--border-subtle)] font-mono text-[10px]">esc</span> to close
          </div>
          <div>V.E.C.T.O.R Search Engine</div>
        </div>
      </div>
    </div>
  );
};

export default SearchOverlay;
