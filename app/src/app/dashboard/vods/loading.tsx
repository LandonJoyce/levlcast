/** Streams, while it loads: the same rows, empty. */
export default function Loading() {
  return (
    <>
      <div className="hm-hello">
        <div>
          <div className="sk" style={{ width: 190, height: 40 }} />
          <div className="sk" style={{ width: 220, height: 12, marginTop: 14 }} />
        </div>
      </div>
      <ul className="sl" aria-hidden="true">
        {[...Array(6)].map((_, i) => (
          <li key={i} className="sl-row">
            <div className="sl-thumb sk" />
            <div className="sl-main">
              <div className="sk" style={{ width: `${45 + ((i * 17) % 30)}%`, height: 14 }} />
              <div className="sk" style={{ width: 120, height: 10, marginTop: 10 }} />
              <div className="sk" style={{ width: `${60 + ((i * 11) % 25)}%`, height: 12, marginTop: 12 }} />
            </div>
            <div className="sl-end">
              <div className="sk" style={{ width: 84, height: 26 }} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
