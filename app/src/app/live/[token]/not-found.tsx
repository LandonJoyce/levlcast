import DeadLink from "./DeadLink";
import "../live.css";

/** A panel link that doesn't exist (or was replaced), inside an OBS dock: say so in the panel's own look, not the site's 404. */
export default function LiveLinkNotFound() {
  return (
    <div className="ld-root">
      <div className="ld">
        <DeadLink />
      </div>
    </div>
  );
}
