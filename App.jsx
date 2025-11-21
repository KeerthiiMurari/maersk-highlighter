import React, { useRef, useState } from 'react'
import PdfViewer from './PdfViewer'

/**
 * IMPORTANT: This should be the path to the PDF in your environment.
 * The assistant environment uses: /mnt/data/Maersk Q2 2025 Interim Report (1).pdf
 *
 * Replace this value if you run locally and your PDF is in a different path.
 */
const PDF_URL = '/mnt/data/Maersk Q2 2025 Interim Report (1).pdf'

export default function App() {
  const viewerRef = useRef(null)
  const [highlighted, setHighlighted] = useState(false)

  // Called when user clicks the [3] link
  const onClickReference3 = async () => {
    setHighlighted(false)
    // Ask PdfViewer to highlight the phrase on page 15
    if (viewerRef.current?.highlightPhrase) {
      const ok = await viewerRef.current.highlightPhrase({
        phrase: 'Gain on sale of non-current assets',
        pageNumber: 15
      })
      setHighlighted(Boolean(ok))
    }
  }

  return (
    <div className="app-grid">
      <div className="left-panel">
        <h2>PDF — Maersk Q2 2025 Interim Report</h2>
        <PdfViewer ref={viewerRef} url={PDF_URL} />
      </div>

      <div className="right-panel">
        <h2>Analysis</h2>
        <p>
          No extraordinary or one-off items affecting EBITDA were reported in Maersk’s Q2 2025 results...
        </p>

        <h3>Findings</h3>
        <ol>
          <li>Page 3 — Highlights Q2 2025</li>
          <li>Page 5 — Review Q2 2025</li>
          <li>
            Page 15 — Condensed Income Statement —{' '}
            <button
              className="ref-button"
              onClick={onClickReference3}
              title="Click to highlight 'Gain on sale of non-current assets' on page 15"
            >
              [3]
            </button>
          </li>
        </ol>

        <div className="status">
          {highlighted ? (
            <div className="ok">Highlighted on page 15 ✅</div>
          ) : (
            <div className="warn">Click [3] to highlight the phrase on page 15</div>
          )}
        </div>
      </div>
    </div>
  )
}
