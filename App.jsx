
import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const PDF_URL = "/Maersk Q2 2025 Interim Report (1).pdf";

export default function App(){
  const containerRef = useRef(null);
  const pagesRef = useRef([]);
  const pdfRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [currentPage, setCurrentPage] = useState(1);
  const [foundCount, setFoundCount] = useState(0);
  const [lastQuery, setLastQuery] = useState("");

  useEffect(() => {
    let mounted = true;
    (async ()=>{
      const loadingTask = pdfjsLib.getDocument(PDF_URL);
      const pdf = await loadingTask.promise;
      pdfRef.current = pdf;
      if(!mounted) return;
      setNumPages(pdf.numPages);
      // render pages
      const container = containerRef.current;
      container.innerHTML = "";
      pagesRef.current = [];
      for(let p=1;p<=pdf.numPages;p++){
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale });
        const wrapper = document.createElement("div");
        wrapper.className = "pdf-page";
        wrapper.style.width = viewport.width + "px";
        wrapper.style.height = viewport.height + "px";
        // canvas
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = viewport.width + "px";
        canvas.style.height = viewport.height + "px";
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;

        // text layer
        const textLayerDiv = document.createElement("div");
        textLayerDiv.className = "text-layer";
        textLayerDiv.style.position = "absolute";
        textLayerDiv.style.left = "0";
        textLayerDiv.style.top = "0";
        textLayerDiv.style.width = viewport.width + "px";
        textLayerDiv.style.height = viewport.height + "px";
        textLayerDiv.style.pointerEvents = "none";

        // label
        const label = document.createElement("div");
        label.className = "page-label";
        label.textContent = `Page ${p}`;

        wrapper.appendChild(canvas);
        wrapper.appendChild(textLayerDiv);
        wrapper.appendChild(label);
        container.appendChild(wrapper);

        const textContent = await page.getTextContent();
        // render textDivs using pdfjs renderTextLayer utility if available
        try{
          pdfjsLib.renderTextLayer({
            textContent,
            container: textLayerDiv,
            viewport,
            textDivs: []
          });
        }catch(e){
          // fallback - ignore
        }

        pagesRef.current[p-1] = { page, viewport, wrapper, textLayerDiv, textContent };
      }
    })();

    return ()=>{ mounted=false; if(containerRef.current) containerRef.current.innerHTML=""; }
  }, [scale]);

  const clearHighlights = ()=>{
    pagesRef.current.forEach(p=>{
      if(!p) return;
      const existing = p.wrapper.querySelectorAll(".highlight-overlay");
      existing.forEach(e=>e.remove());
    });
    setFoundCount(0);
  };

  const highlightText = async (query, exact=false) => {
    if(!pdfRef.current || !query) return;
    setLastQuery(query);
    clearHighlights();
    const q = query.toLowerCase();
    const highlights = [];
    for(let i=0;i<pagesRef.current.length;i++){
      const p = pagesRef.current[i];
      if(!p) continue;
      const items = p.textContent.items || [];
      for(let t=0;t<items.length;t++){
        const item = items[t];
        const str = item.str || "";
        const match = exact ? (str.toLowerCase().includes(q)) : (str.toLowerCase().includes(q));
        if(match){
          // compute transform
          const tx = pdfjsLib.Util.transform(p.viewport.transform, item.transform);
          const x = tx[4];
          const y = tx[5];
          const fontHeight = Math.hypot(tx[1], tx[3]);
          const width = (item.width || 20) * p.viewport.scale;
          const height = fontHeight || 12;
          const overlay = document.createElement("div");
          overlay.className = "highlight-overlay";
          overlay.style.left = x + "px";
          overlay.style.top = (y - height) + "px";
          overlay.style.width = Math.max(20, width) + "px";
          overlay.style.height = Math.max(12, height + 4) + "px";
          p.wrapper.appendChild(overlay);
          highlights.push({page:i+1});
        }
      }
    }
    setFoundCount(highlights.length);
    if(highlights.length>0){
      const first = pagesRef.current[highlights[0].page-1];
      first && first.wrapper.scrollIntoView({behavior:"smooth", block:"center"});
    }
  };

  const onClickRef3 = ()=> highlightText("Gain on sale of non-current assets", true);

  const zoomIn = ()=> setScale(s=>Math.min(2.5, +(s+0.1).toFixed(2)));
  const zoomOut = ()=> setScale(s=>Math.max(0.6, +(s-0.1).toFixed(2)));
  const goToPage = (n)=>{
    const p = Math.max(1, Math.min(numPages, n));
    const pageObj = pagesRef.current[p-1];
    if(pageObj) pageObj.wrapper.scrollIntoView({behavior:"smooth", block:"center"});
    setCurrentPage(p);
  };

  const onSearch = (e)=>{
    e.preventDefault();
    const form = e.target;
    const q = form.query.value.trim();
    highlightText(q, false);
  };

  return (
    <div className="app">
      <div className="left">
        <div className="toolbar">
          <div className="controls">
            <button className="btn" onClick={zoomOut}>− Zoom</button>
            <button className="btn" onClick={zoomIn}>+ Zoom</button>
            <button className="btn" onClick={()=>{clearHighlights();}}>Clear highlights</button>
            <div style={{display:"flex",alignItems:"center"}} className="small">
              <span style={{marginLeft:8}}>Scale: {scale.toFixed(2)}</span>
            </div>
          </div>
          <div style={{marginLeft:"auto"}} className="small">Pages: {numPages}</div>
        </div>

        <div ref={containerRef} />
      </div>

      <div className="right">
        <h2 style={{marginTop:0}}>Analysis</h2>
        <p className="small">No extraordinary or one-off items affecting EBITDA were reported in Maersk’s Q2 2025 results. The report explicitly notes that EBITDA improvements stemmed from operational performance — including volume growth, cost control, and margin improvement across Ocean, Logistics & Services, and Terminals segments <span style={{color:'#2563eb'}}>[1][2]</span>. Gains or losses from asset sales, which could qualify as extraordinary items, are shown separately under EBIT and not included in EBITDA. The <button onClick={onClickRef3} style={{textDecoration:'underline', background:'none', border:'none', color:'#b45309', cursor:'pointer'}}>[3] Gain on sale of non-current assets, etc</button> was USD 25 m in Q2 2025, significantly lower than USD 208 m in Q2 2024, but these affect EBIT, not EBITDA.</p>

        <div style={{marginTop:12}} className="controls">
          <form onSubmit={onSearch}>
            <input name="value" className="search-box" name="query" placeholder="Search text in PDF (e.g. 'Gain on sale')" />
            <button className="btn" type="submit" style={{marginLeft:8}}>Search</button>
          </form>

          <div style={{marginLeft:8}} className="small">Found: {foundCount}</div>

          <div style={{marginLeft:"auto", display:"flex", gap:8}}>
            <input type="number" min="1" max={numPages} value={currentPage} onChange={(e)=>setCurrentPage(Number(e.target.value)||1)} style={{width:72,padding:8,borderRadius:8,border:'1px solid #e5e7eb'}} />
            <button className="btn" onClick={()=>goToPage(currentPage)}>Go</button>
          </div>
        </div>

        <h3>Findings</h3>
        <ul>
          <li>Page 3 — Highlights Q2 2025: EBITDA increase (USD 2.3 bn vs USD 2.1 bn prior year) attributed to operational improvements; no mention of extraordinary or one-off items. [1]</li>
          <li>Page 5 — Review Q2 2025: EBITDA rise driven by higher revenue and cost control across all segments; no extraordinary gains or losses included. [2]</li>
          <li>Page 15 — Condensed Income Statement: <button onClick={onClickRef3} style={{textDecoration:'underline', background:'none', border:'none', color:'#b45309', cursor:'pointer'}}>[3]</button> Gain on sale of non-current assets USD 25 m (vs USD 208 m prior year).</li>
        </ul>

        <div style={{marginTop:12, padding:12, background:"#fff", borderRadius:8}}>
          <h4 style={{margin:'4px 0'}}>Supporting Evidence</h4>
          <ol>
            <li>Page 3 — Highlights Q2 2025 (see PDF).</li>
            <li>Page 5 — Review Q2 2025 (see PDF).</li>
            <li>Page 15 — Condensed Income Statement; click <button onClick={onClickRef3} style={{textDecoration:'underline', background:'none', border:'none', color:'#b45309', cursor:'pointer'}}>[3]</button> to highlight in the PDF.</li>
          </ol>
        </div>

        <div className="footer-note">
          Tip: Use the zoom controls and the search box to fine-tune highlight positions. If highlight boxes appear slightly offset, increase/decrease the scale and retry the search.
        </div>
      </div>
    </div>
  );
}
