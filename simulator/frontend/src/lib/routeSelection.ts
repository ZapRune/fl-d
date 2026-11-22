import type { SimRequest } from './api'

/** Storm changes can stream; a result for another route selection cannot. */
export function sameRouteSelection(a: SimRequest, b: SimRequest): boolean {
  return a.event === b.event && a.vehicle === b.vehicle && a.hospital === b.hospital &&
    a.dest === b.dest && a.dest_lonlat?.[0] === b.dest_lonlat?.[0] &&
    a.dest_lonlat?.[1] === b.dest_lonlat?.[1] &&
    a.trip?.start[0] === b.trip?.start[0] && a.trip?.start[1] === b.trip?.start[1] &&
    a.trip?.end[0] === b.trip?.end[0] && a.trip?.end[1] === b.trip?.end[1]
}
