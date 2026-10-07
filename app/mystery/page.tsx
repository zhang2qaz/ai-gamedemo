import type { Metadata } from 'next'
import MysteryApp from '@/components/mystery/MysteryApp'
import { SCENARIO_METAS } from '@/engine/mystery/scenarios/meta'
import './mystery.css'

export const metadata: Metadata = {
  title: '线上剧本杀 · 电脑 DM',
  description: SCENARIO_METAS.map(m => `《${m.title}》（${m.audience} · ${m.players}）`).join(' '),
}

export default function MysteryPage() {
  return <MysteryApp />
}
