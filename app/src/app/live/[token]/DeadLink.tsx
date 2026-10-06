/**
 * What the panel shows when its link doesn't work: it was replaced by a
 * newer one (Make a new link, on the Live page) or copied wrong. From an
 * OBS dock, the button opens in the streamer's own browser.
 */
export default function DeadLink() {
  return (
    <section className="ld-dead" aria-label="This link doesn't work">
      <p className="ld-dead-t">This link doesn&apos;t work anymore</p>
      <p className="ld-dead-s">
        It was replaced by a newer one, or it got copied wrong. Copy your current link and paste it over this one in OBS, under{" "}
        <b>Docks</b>, <b>Custom Browser Docks</b>.
      </p>
      <a className="ld-report-go" href="/dashboard/live" target="_blank" rel="noopener noreferrer">
        Get my link
      </a>
    </section>
  );
}
