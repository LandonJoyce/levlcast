import type { CoachingArcData } from "@/lib/coaching-arc";

/**
 * What the coach sees across the last several streams, on the Matches
 * page: the habits that keep coming back, the ones getting better, and a
 * short read on the whole run. It used to open with a row of score or
 * emblem circles, one per stream, which the match list right under it
 * already shows better.
 */
export function CoachingArcCard({ arc }: { arc: CoachingArcData }) {
  const recurring = arc.recurring_improvements;
  const improving = arc.improving_areas;

  return (
    <div className="ca">
      {(recurring.length > 0 || improving.length > 0) && (
        <div className="ca-cols" data-two={recurring.length > 0 && improving.length > 0 ? "yes" : undefined}>
          {recurring.length > 0 && (
            <div>
              <p className="hm-k ca-k-bad">Still working on</p>
              <ul className="ca-list">
                {recurring.map((item, i) => {
                  const examples = arc.recurring_examples?.[i] ?? [];
                  return (
                    <li key={i}>
                      <p>{item}</p>
                      {examples.length > 0 && (
                        // Lines the streamer could actually say next stream.
                        <div className="ca-try">
                          <span>Try saying</span>
                          {examples.map((ex, j) => (
                            <q key={j}>{ex}</q>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {improving.length > 0 && (
            <div>
              <p className="hm-k ca-k-good">Getting better</p>
              <ul className="ca-list">
                {improving.map((item, i) => (
                  <li key={i}>
                    <p>{item}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {arc.synthesis && <p className="ca-synth">{arc.synthesis}</p>}
    </div>
  );
}
