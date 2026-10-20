import {dateLine, timeParts, type TimeFormat} from '../lib/clock';

/** Clock in the top-right corner: the time, with the date directly under it. */
export function Clock ({now, format}: {now: Date; format: TimeFormat}) {
	const {time, period} = timeParts(now, format);
	return (
		<div class="clock">
			<div class="clock__time">
				{time}
				{period && <span class="clock__period">{period}</span>}
			</div>
			<div class="clock__date">{dateLine(now)}</div>
		</div>
	);
}
