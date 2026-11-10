"use client"

type CountBadgeProps = {
  count: number
}

const CountBadge = ({ count }: CountBadgeProps) =>
  count > 0 ? (
    <span
      data-testid="count-badge"
      className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 rounded-full bg-hunter-gold text-hunter-dark font-sans font-bold text-[11px] flex items-center justify-center tracking-normal mt-1"
    >
      {count > 99 ? "99+" : count}
    </span>
  ) : null

export default CountBadge
