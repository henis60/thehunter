"use client"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import { useEffect, useRef } from "react"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"
import { EawbLocker, EawbLockerOrigin } from "@lib/data/fulfillment"
import { addressIcon, lockerIcon, selectedLockerIcon } from "./leaflet-icons"

const ROMANIA_CENTER: [number, number] = [45.9432, 24.9668]
const ROMANIA_ZOOM = 6
const MAX_FIT_ZOOM = 15
const ORIGIN_ZOOM = 14

type LockerMapProps = {
  lockers: EawbLocker[]
  selectedLocker: EawbLocker | null
  onSelect: (locker: EawbLocker) => void
  origin: EawbLockerOrigin
}

function FitToLockers({
  lockers,
  selectedLocker,
  origin,
}: {
  lockers: EawbLocker[]
  selectedLocker: EawbLocker | null
  origin: EawbLockerOrigin
}) {
  const map = useMap()
  const hasFitLockersOnce = useRef(false)
  // A selected locker restored from the cart (on returning to this step, or
  // preselected on initial load) doesn't carry coordinates on its own object
  // — only a locker picked just now in this session does. Resolve it against
  // the full locker list (which does have coordinates for every locker) by
  // id so a restored/preselected locker still gets focused, not just one
  // picked live.
  const resolvedSelected = selectedLocker
    ? lockers.find((l) => l.id === selectedLocker.id) ?? selectedLocker
    : null
  const hasSelectedCoords = resolvedSelected?.lat != null && resolvedSelected?.lng != null

  // A selected locker always takes precedence. Always zoom in to a focused
  // level — not just "at most MAX_FIT_ZOOM" — since the bounds-fit fallback
  // below can leave the map zoomed way out (e.g. fit to every locker in a
  // whole city), and capping against that stale zoom would leave a selected
  // locker looking un-zoomed.
  //
  // Keyed on the resolved locker's identity and coordinates rather than on the
  // `lockers` array: that array is the SEARCH-FILTERED list, rebuilt on every
  // keystroke, so depending on it re-centred the map while the customer was
  // typing and threw away the pan/zoom they were in the middle of. Depending on
  // the coordinates still covers the restore case — a locker preselected from
  // the cart arrives without lat/lng and only gains them once the list loads,
  // and that transition re-runs this effect and focuses it.
  const selectedLat = resolvedSelected?.lat ?? null
  const selectedLng = resolvedSelected?.lng ?? null

  useEffect(() => {
    if (selectedLat != null && selectedLng != null) {
      map.setView([selectedLat, selectedLng], ORIGIN_ZOOM)
    }
  }, [resolvedSelected?.id, selectedLat, selectedLng])

  // The geocoded address is fetched separately from the locker list (it can
  // arrive later, since it's a slower external lookup) — re-center on it the
  // moment it shows up, even if the bounds-fit fallback below already ran.
  useEffect(() => {
    if (!origin || hasSelectedCoords) return
    map.setView([origin.lat, origin.lng], ORIGIN_ZOOM)
  }, [origin, hasSelectedCoords])

  // Fallback while there's no geocoded origin yet (or it never resolves):
  // fit to the locker pins' bounds, once.
  useEffect(() => {
    if (origin || hasSelectedCoords || hasFitLockersOnce.current) return

    const withCoords = lockers.filter((l) => l.lat != null && l.lng != null)
    if (withCoords.length === 0) {
      map.setView(ROMANIA_CENTER, ROMANIA_ZOOM)
      hasFitLockersOnce.current = true
      return
    }

    const bounds = L.latLngBounds(
      withCoords.map((l) => [l.lat as number, l.lng as number])
    )
    map.fitBounds(bounds, { maxZoom: MAX_FIT_ZOOM, padding: [24, 24] })
    hasFitLockersOnce.current = true
  }, [lockers, origin, hasSelectedCoords])

  return null
}

// Removes Leaflet's own "Leaflet" branding from the attribution control while
// keeping the OpenStreetMap/CARTO credit their usage policies require.
function StripLeafletPrefix() {
  const map = useMap()
  useEffect(() => {
    map.attributionControl.setPrefix(false)
  }, [map])
  return null
}

export default function LockerMap({ lockers, selectedLocker, onSelect, origin }: LockerMapProps) {
  const withCoords = lockers.filter((l) => l.lat != null && l.lng != null)

  return (
    <div className="h-56 sm:h-72 md:h-80 w-full">
      <MapContainer
        center={ROMANIA_CENTER}
        zoom={ROMANIA_ZOOM}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains="abc"
        />
        <FitToLockers lockers={withCoords} selectedLocker={selectedLocker} origin={origin} />
        <StripLeafletPrefix />
        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={addressIcon}>
            <Popup>
              <span className="font-sans text-[13px]">Adresa ta de livrare</span>
            </Popup>
          </Marker>
        )}
        {withCoords.map((locker) => (
          <Marker
            key={locker.id}
            position={[locker.lat as number, locker.lng as number]}
            icon={selectedLocker?.id === locker.id ? selectedLockerIcon : lockerIcon}
            eventHandlers={{ click: () => onSelect(locker) }}
          >
            <Popup>
              <span className="font-sans text-[13px]">
                <strong>{locker.name}</strong>
                <br />
                {locker.address}
              </span>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
