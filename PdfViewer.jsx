import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf'

// Configure worker for pdfjs with Vite-friendly URL
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.js',
  import.meta.url
).toString()

const PdfViewer = forwardRef(({ url }, ref) => {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [viewport, setViewport] = useState(null)
  const [currentPageNum, setCurrentPageNum] = useState(1)
  const overlayRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    const loadPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(url)
        const pdf = await loadingTask.promise
        if (cancelled) return
        setPdfDoc(pdf)
        // load page 15 by default (if exists)
        const pageNum = Math.min(Math.max(1, 15), pdf.numPages)
        await renderPage(pdf, pageNum)
        setCurrentPageNum(pageNum)
      } catch (err) {
        console.error('PDF load error', err)
      }
    }
    loadPdf()
    return () => (cancelled = true)
  }, [url])

  // Render a given page to canvas
  const renderPage = async (pdf, pageNumber) => {
    const page = await pdf.getPage(pageNumber)
    const scale = 1.25
    const vp = page.getViewport({ scale })
    setViewport(vp)
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    canvas.width = Math.floor(vp.width)
    canvas.height = Math.floor(vp.height)
    canvas.style.width = canvas.width + 'px'
    canvas.style.height = canvas.height + 'px'

    // clear overlay
    if (overlayRef.current) {
      overlayRef.current.innerHTML = ''
      overlayRef.current.style.width = canvas.style.width
      overlayRef.current.style.height = canvas.style.height
    }

    const renderContext = {
      canvasContext: context,
      viewport: vp
    }
    await page.render(renderContext).promise
    return page
  }

  // find text items matching phrase on given page and create highlight overlay(s)
  const highlightPhraseOnPage = async ({ phrase, pageNumber }) => {
    if (!pdfDoc) return false
    try {
      const page = await pdfDoc.getPage(pageNumber)
      const textContent = await page.getTextContent()
      // normalize search
      const normalizedPhrase = phrase.trim().toLowerCase()

      // collect matching items as contiguous runs
      const matches = []

      // We'll find items where the item.str contains the phrase or parts of it,
      // and combine runs that are adjacent.
      for (let i = 0; i < textContent.items.length; i++) {
        const item = textContent.items[i]
        const s = (item.str || '').toLowerCase()
        if (s.includes(normalizedPhrase) || normalizedPhrase.includes(s) || s.includes(normalizedPhrase.split(' ')[0])) {
          // get the rectangle for this item
          const tx = item.transform // [a, b, c, d, e, f]
          // We will compute bounding box using transform and fontSize/width
          // item.width exists; item.height sometimes not; use fontSize from transform
          matches.push({ item, index: i })
        }
      }

      // If no direct matches found, try fuzzy by matching words
      if (matches.length === 0) {
        const words = normalizedPhrase.split(/\s+/)
        for (let i = 0; i < textContent.items.length; i++) {
          const item = textContent.items[i]
          const s = (item.str || '').toLowerCase()
          if (words.some(w => s.includes(w))) {
            matches.push({ item, index: i })
          }
        }
      }

      // If still nothing, return false
      if (matches.length === 0) {
        console.warn('No text items matched the phrase:', phrase)
        return false
      }

      // convert each matched item to viewport rectangle and add overlay div
      const vp = page.getViewport({ scale: 1.25 })
      const overlay = overlayRef.current
      overlay.innerHTML = '' // clear previous highlights

      // pdfjs text item transform -> bounding box calculation:
      // transform = [a, b, c, d, e, f] where:
      // e,f = x,y (bottom-left of text)
      // a = scale x, d = scale y (approx). width = item.width
      // We'll approximate width and height.
      matches.forEach(m => {
        const it = m.item
        const tr = it.transform // [a,b,c,d,e,f]
        const x = tr[4]
        const y = tr[5]
        const a = tr[0]
        const d = tr[3]
        const fontHeight = Math.hypot(tr[1], tr[3]) || Math.abs(d) || 10
        const textWidth = it.width ? it.width * a : (String(it.str).length * (fontHeight * 0.5))
        // create PDF-space rect [x, y, x+width, y+height]
        const pdfRect = [x, y, x + textWidth, y + fontHeight]
        const vRect = vp.convertToViewportRectangle(pdfRect) // [x1,y1,x2,y2] in px
        // convert to top-left, width, height
        const left = Math.min(vRect[0], vRect[2])
        const top = Math.min(vRect[1], vRect[3])
        const width = Math.abs(vRect[2] - vRect[0])
        const height = Math.abs(vRect[3] - vRect[1])

        // create overlay div
        const div = document.createElement('div')
        div.className = 'highlight-box'
        // the viewport's y-axis flips, so need to position correctly using overlay container's height
        div.style.left = `${left}px`
        // convert to top relative to canvas height
        const canvasHeight = vp.height
        // vRect provides top-left in PDF coordinate; using top is fine because we set overlay same size as canvas
        div.style.top = `${top}px`
        div.style.width = `${Math.max(10, width)}px`
        div.style.height = `${Math.max(8, height)}px`
        overlay.appendChild(div)
      })

      return true
    } catch (err) {
      console.error('highlight error', err)
      return false
    }
  }

  // expose method to parent via ref
  useImperativeHandle(ref, () => ({
    highlightPhrase: async ({ phrase, pageNumber }) => {
      const ok = await highlightPhraseOnPage({ phrase, pageNumber })
      if (!ok) {
        // try re-render page and then try again
        if (pdfDoc) {
          await renderPage(pdfDoc, pageNumber)
          return highlightPhraseOnPage({ phrase, pageNumber })
        }
      }
      return ok
    }
  }))

  return (
    <div className="pdf-container" ref={containerRef}>
      <canvas ref={canvasRef} className="pdf-canvas" />
      <div ref={overlayRef} className="overlay" />
      <div className="page-indicator">Page {currentPageNum}</div>
    </div>
  )
})

export default PdfViewer
