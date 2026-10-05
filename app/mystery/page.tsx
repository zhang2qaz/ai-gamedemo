import type { Metadata } from 'next'
import MysteryApp from '@/components/mystery/MysteryApp'
import { SCENARIO_META } from '@/engine/mystery/scenarios/meta'
import './mystery.css'

export const metadata: Metadata = {
  title: `${SCENARIO_META.title} · ${SCENARIO_META.players}线上剧本杀`,
  description: SCENARIO_META.subtitle,
}

export default function MysteryPage() {
  return <MysteryApp />
}
