'use client'
import { QueuePanel } from './queue-panel'
import { ActivityFeed } from './activity-feed'

export function Sidebar() {
  return (
    <div className="flex flex-col gap-0 h-full">
      <QueuePanel />
      <div className="border-t border-border" />
      <ActivityFeed />
    </div>
  )
}
