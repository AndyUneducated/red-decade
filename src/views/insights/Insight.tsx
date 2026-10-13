import type { ReactNode } from 'react'
import { PageTitle } from '../../components/PageTitle'

// The frame every insight page shares: the question it asks, then how the answer was computed and what the
// data cannot say. The method is part of the finding, so it is always on the page, not in a footnote.
export function Insight({ question, method, caveats, children }: { question: ReactNode; method: ReactNode; caveats?: ReactNode; children: ReactNode }) {
  return (
    <div className="view">
      <div className="insight">
        <header className="insight-head">
          <PageTitle />
          <p className="question">{question}</p>
          <details className="method">
            <summary>方法与局限</summary>
            <p>{method}</p>
            {caveats && <p>{caveats}</p>}
          </details>
        </header>
        {children}
      </div>
    </div>
  )
}
