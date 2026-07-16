'use client';

import { useState } from 'react';
import { Upload, Settings, FileText, Wallet, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  activeTab: 'workspace' | 'usage' | 'settings';
  onTabChange: (tab: 'workspace' | 'usage' | 'settings') => void;
  credits: number;
}

export function Sidebar({ activeTab, onTabChange, credits }: SidebarProps) {
  return (
    <aside className="w-64 h-screen bg-white border-r border-gray-200 fixed left-0 top-0 z-40">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl text-gray-900">Source2Txt</span>
        </div>
      </div>

      <nav className="p-4">
        <button
          onClick={() => onTabChange('workspace')}
          className={cn(
            'sidebar-link w-full text-left mb-1',
            activeTab === 'workspace' && 'sidebar-link-active'
          )}
        >
          <Upload className="w-5 h-5" />
          <span>Workspace</span>
        </button>

        <button
          onClick={() => onTabChange('usage')}
          className={cn(
            'sidebar-link w-full text-left mb-1',
            activeTab === 'usage' && 'sidebar-link-active'
          )}
        >
          <Wallet className="w-5 h-5" />
          <span>Usage</span>
          <span className="ml-auto text-sm font-medium text-gray-500">{credits.toFixed(2)} credits</span>
        </button>

        <button
          onClick={() => onTabChange('settings')}
          className={cn(
            'sidebar-link w-full text-left mb-1',
            activeTab === 'settings' && 'sidebar-link-active'
          )}
        >
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <User className="w-4 h-4" />
          <span>Account</span>
        </div>
      </div>
    </aside>
  );
}
