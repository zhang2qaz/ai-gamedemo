// 测试用最小剧本（覆盖引擎的全部通用能力）
import type { ScenarioRuntime } from './runtime'
import type { GameState, ResultView } from './types'
import { SEATS } from './types'

export const fixtureRuntime: ScenarioRuntime = {
  scenario: {
    id: 'fixture',
    title: '测试剧本',
    subtitle: '引擎单元测试',
    tagline: '',
    intro: '',
    era: '2017',
    duration: '1 分钟',
    roles: [
      { id: 'a', name: '甲', enName: 'A', title: '记者', avatar: '📰', color: '#f00', publicProfile: '甲的公开简介', money: 100,
        script: [
          { id: 'c1', title: '第一幕', text: '甲的第一幕', from: 'read1' },
          { id: 'c2', title: '第二幕', text: '甲的第二幕', from: 'read2' },
        ],
        goals: [{ id: 'g1', text: '拿到钥匙', points: 10, check: { owns: 'key' } }] },
      { id: 'b', name: '乙', enName: 'B', title: '保镖', avatar: '🕶️', color: '#00f', publicProfile: '乙的公开简介', money: 50,
        script: [
          { id: 'c1', title: '第一幕', text: '乙的第一幕', from: 'read1' },
        ],
        goals: [] },
    ],
    npcs: [
      { id: 'maid', name: '女佣', title: '女佣', avatar: '🧹', profile: '', questions: [
        { id: 'q1', ask: '你看到了什么？', answer: '什么都没看到。' },
        { id: 'q2', ask: '这是什么？', answer: '是钥匙……好吧我说。', present: 'key', grants: ['testimony'] },
      ] },
    ],
    locations: [{ id: 'study', name: '书房', icon: '📚', desc: '' }],
    clues: [
      { id: 'key', title: '钥匙', icon: '🔑', kind: 'physical', text: '一把钥匙', location: 'study', spot: '抽屉', cost: 1 },
      { id: 'safe', title: '保险箱', icon: '🗄️', kind: 'physical', text: '保险箱里有信', location: 'study', spot: '保险箱', cost: 2, requires: { hasClue: 'key' } },
      { id: 'diary', title: '日记', icon: '📓', kind: 'document', text: '只有乙认得字迹', location: 'study', spot: '书架', cost: 1, onlyRole: 'b' },
      { id: 'body', title: '尸体', icon: '⚰️', kind: 'physical', text: '尸体', location: 'study', spot: '地毯', cost: 1, autoPublic: true },
      { id: 'testimony', title: '女佣证词', icon: '🗣️', kind: 'testimony', text: '证词' },
    ],
    flow: [
      { id: 'open', kind: 'story', title: '开场', text: '开场白' },
      { id: 'read1', kind: 'read', title: '第一幕', chapter: 'c1' },
      { id: 'search1', kind: 'search', title: '搜证', ap: 3, seconds: 60 },
      { id: 'choose', kind: 'choice', title: '抉择', choice: {
        a: { prompt: '说不说？', options: [{ id: 'yes', label: '说', effects: [{ setFlag: 'aTalked', value: true }] }, { id: 'no', label: '不说' }] },
      } },
      { id: 'read2', kind: 'read', title: '第二幕', chapter: 'c2' },
      { id: 'accuse', kind: 'accuse', title: '指认' },
      { id: 'end', kind: 'ending', title: '结局' },
    ],
    caseFiles: [
      { id: 'case1', title: '谁拿了钥匙', desc: '', reward: 500, penalty: 100, maxAttempts: 2, opens: 'search1', closes: 'read2',
        questions: [{ id: 'who', prompt: '谁', options: [{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }], answer: 'y' }] },
    ],
    accuse: [
      { id: 'killer', prompt: '凶手', options: [{ id: 'maid', label: '女佣' }, { id: 'a', label: '甲' }], answer: 'maid', points: 10 },
    ],
    endings: [{ id: 'e', title: '结局', text: '完' }],
    truth: [{ title: '真相', text: '女佣' }],
  },
  finale: null,
  result(state: GameState): ResultView {
    return {
      headline: '测试结束',
      endings: SEATS.map(s => ({ seat: s, roleName: s, title: 'E', text: '' })),
      scores: [],
      accuseReview: [],
      truth: [],
      secrets: [state.flags.aTalked ? '甲说了' : '甲没说'],
    }
  },
}
