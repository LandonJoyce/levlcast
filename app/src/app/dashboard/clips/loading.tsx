/** Clips, while it loads: the cards and the moment rows, empty. */
export default function Loading() {
  return (
    <>
      <div className="hm-hello">
        <div>
          <div className="sk" style={{ width: 130, height: 40 }} />
          <div className="sk" style={{ width: 260, height: 12, marginTop: 14 }} />
        </div>
      </div>
      <section className="hm-sec" aria-hidden="true">
        <div className="sk" style={{ width: 180, height: 22 }} />
        <div className="cl-grid">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="cl-card">
              <div className="cl-thumb sk" />
              <div className="sk" style={{ width: "80%", height: 12, marginTop: 12 }} />
              <div className="sk" style={{ width: "55%", height: 10, marginTop: 8 }} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
