import { Sparkles } from 'lucide-react'

const RIBBON_TEXT =
    'ITF 6202 LLM Course Mini Project | AssignIQ - Intelligent Assignment Generation and Evaluation System | Developed by Hari Srini R' // | Course Teacher: Dr. P. LATCHOUMY (Associate Professor/IT)'
export default function AnimatedTopRibbon() {
    return (
        <div className="assigniq-ribbon">
            <div className="assigniq-ribbon-glow" />

            <div className="assigniq-ribbon-single">
                <div className="assigniq-ribbon-item">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-200 flex-shrink-0" />
                    <span>{RIBBON_TEXT}</span>
                </div>
            </div>
        </div>
    )
}