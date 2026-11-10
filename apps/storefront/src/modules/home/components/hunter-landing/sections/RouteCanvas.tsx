"use client"

import { useEffect, useRef } from "react"

export default function RouteCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const ctx = cvs.getContext("2d")
    if (!ctx) return
    let stopped = false

    // next/font exposes the loaded family through a CSS var (not the literal
    // "Raleway" name), and canvas ctx.font can't resolve var() itself.
    const ralewayFamily =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--font-raleway")
        .trim() || "Raleway"

    // Sets the label font on the context; returns its pixel size.
    function setLabelFont(isHub: boolean, small: boolean) {
      const fontPx = isHub ? (small ? 11 : 15) : small ? 10 : 13
      ctx!.font = `${isHub ? 500 : 400} ${fontPx}px ${ralewayFamily},sans-serif`
      ctx!.letterSpacing = isHub
        ? small
          ? "2px"
          : "4px"
        : small
        ? "1.5px"
        : "3px"
      return fontPx
    }

    // Only the hub and the inspiration cities named in the caption next to
    // the canvas (About.tsx). Real coordinates, projected below.
    const CITIES = [
      { name: "The Hunter House", lat: 47.6567, lon: 23.585, hub: true }, // Baia Mare
      { name: "Londra", lat: 51.5074, lon: -0.1278, hub: false },
      { name: "Milano", lat: 45.4642, lon: 9.19, hub: false },
      { name: "Paris", lat: 48.8566, lon: 2.3522, hub: false },
      { name: "Viena", lat: 48.2082, lon: 16.3738, hub: false },
      { name: "Zurich", lat: 47.3769, lon: 8.5417, hub: false },
    ].map((c) => ({ ...c, x: 0, y: 0 }))
    type City = (typeof CITIES)[number]

    // Logical (CSS px) canvas size; the backing store is scaled by DPR so
    // labels stay crisp on high-density screens.
    let W = 0
    let H = 0

    // Web-Mercator projection, fitted to the canvas with ONE uniform scale
    // (so relative positions/distances are geographically true), centered,
    // with padding reserved for the labels.
    const mercY = (lat: number) =>
      Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
    const toRad = (deg: number) => (deg * Math.PI) / 180
    function layoutCities() {
      const xs = CITIES.map((c) => toRad(c.lon))
      const ys = CITIES.map((c) => mercY(c.lat))
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const small = W < 480
      const padL = W * (small ? 0.06 : 0.08)
      // The hub is the easternmost point and its label sits to its right
      // like every other city's, so reserve room for that label.
      setLabelFont(true, small)
      const hubLabelW = ctx!.measureText(CITIES[0].name.toUpperCase()).width
      ctx!.letterSpacing = "0px"
      const padR = Math.max(
        W * (small ? 0.1 : 0.08),
        small ? hubLabelW * 0.65 + 14 : hubLabelW + 24
      )
      // The site header overlays the top of this section, so keep the
      // northernmost city (London) and its label clear of it.
      const padT = Math.max(H * 0.2, 96)
      const padB = H * 0.16
      const scale = Math.min(
        (W - padL - padR) / (maxX - minX),
        (H - padT - padB) / (maxY - minY)
      )
      const offX = padL + (W - padL - padR - (maxX - minX) * scale) / 2
      const offY = padT + (H - padT - padB - (maxY - minY) * scale) / 2
      CITIES.forEach((c, i) => {
        c.x = offX + (xs[i] - minX) * scale
        c.y = offY + (maxY - ys[i]) * scale
      })
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = cvs!.offsetWidth
      H = cvs!.offsetHeight
      cvs!.width = Math.round(W * dpr)
      cvs!.height = Math.round(H * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      layoutCities()
    }

    resize()
    const ro = new ResizeObserver(() => resize())
    ro.observe(cvs)
    // Label widths (and so the reserved padding) change once Raleway loads.
    document.fonts?.ready.then(() => {
      if (!stopped) layoutCities()
    })

    const cxF = (c: City) => c.x
    const cyF = (c: City) => c.y

    type Arc = {
      from: City
      to: City
      t: number
      speed: number
      color: string
      trail: { x: number; y: number; age: number }[]
      particles: {
        x: number
        y: number
        vx: number
        vy: number
        life: number
        color: string
      }[]
      done: boolean
    }
    const arcs: Arc[] = []
    const MAX_ARCS = 7

    function spawnArc() {
      const src = CITIES[1 + Math.floor(Math.random() * (CITIES.length - 1))]
      const toHub = Math.random() > 0.35
      arcs.push({
        from: toHub ? src : CITIES[0],
        to: toHub ? CITIES[0] : src,
        t: 0,
        speed: 0.0025 + Math.random() * 0.0018,
        color: Math.random() > 0.45 ? "rgba(201,168,76," : "rgba(42,107,85,",
        trail: [],
        particles: [],
        done: false,
      })
    }

    const pulses = CITIES.map(() => ({ phase: Math.random() * Math.PI * 2 }))
    const bgDots = Array.from({ length: 55 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.2,
      alpha: 0.04 + Math.random() * 0.08,
      speed: 0.00008 + Math.random() * 0.00015,
      dy: (Math.random() - 0.5) * 0.0003,
    }))

    function bezier(
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      cpx: number,
      cpy: number,
      t: number
    ) {
      const mt = 1 - t
      return {
        x: mt * mt * x1 + 2 * mt * t * cpx + t * t * x2,
        y: mt * mt * y1 + 2 * mt * t * cpy + t * t * y2,
      }
    }

    function controlPt(from: City, to: City) {
      const mx = (cxF(from) + cxF(to)) * 0.5
      const my = (cyF(from) + cyF(to)) * 0.5
      const dx = cxF(to) - cxF(from)
      const dy = cyF(to) - cyF(from)
      const len = Math.sqrt(dx * dx + dy * dy)
      return { x: mx - dy * 0.38, y: my + dx * 0.18 - len * 0.22 }
    }

    let _cvVisible = false
    const cvObs = new IntersectionObserver(
      (entries) => {
        _cvVisible = entries[0].isIntersecting
        if (_cvVisible && !stopped) {
          last = performance.now()
          requestAnimationFrame(frame)
        }
      },
      { threshold: 0.01 }
    )
    cvObs.observe(cvs)

    let last = performance.now()
    function frame(now: number) {
      if (stopped || !_cvVisible) return
      requestAnimationFrame(frame)
      const dt = Math.min(now - last, 40)
      last = now
      ctx!.clearRect(0, 0, W, H)
      ctx!.fillStyle = "#0b120e"
      ctx!.fillRect(0, 0, W, H)

      ctx!.strokeStyle = "rgba(201,168,76,.028)"
      ctx!.lineWidth = 1
      for (let x = 0; x < W; x += 48) {
        ctx!.beginPath()
        ctx!.moveTo(x, 0)
        ctx!.lineTo(x, H)
        ctx!.stroke()
      }
      for (let y = 0; y < H; y += 48) {
        ctx!.beginPath()
        ctx!.moveTo(0, y)
        ctx!.lineTo(W, y)
        ctx!.stroke()
      }

      bgDots.forEach((d) => {
        d.x = (d.x + d.speed + 1) % 1
        d.y = (d.y + d.dy + 1) % 1
        ctx!.beginPath()
        ctx!.arc(d.x * W, d.y * H, d.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(201,168,76,${d.alpha})`
        ctx!.fill()
      })

      if (
        arcs.filter((a) => !a.done).length < MAX_ARCS &&
        Math.random() < 0.025
      )
        spawnArc()

      arcs.forEach((arc) => {
        if (arc.done) return
        arc.t = Math.min(arc.t + arc.speed * dt, 1)
        const cp = controlPt(arc.from, arc.to)
        const x1 = cxF(arc.from),
          y1 = cyF(arc.from)
        const x2 = cxF(arc.to),
          y2 = cyF(arc.to)
        const pos = bezier(x1, y1, x2, y2, cp.x, cp.y, arc.t)
        arc.trail.push({ ...pos, age: 0 })
        arc.trail.forEach((p) => (p.age += dt))
        while (arc.trail.length > 1 && arc.trail[0].age > 420) arc.trail.shift()
        if (arc.trail.length > 1) {
          for (let i = 1; i < arc.trail.length; i++) {
            const p0 = arc.trail[i - 1],
              p1 = arc.trail[i]
            ctx!.beginPath()
            ctx!.moveTo(p0.x, p0.y)
            ctx!.lineTo(p1.x, p1.y)
            ctx!.strokeStyle = arc.color + (i / arc.trail.length) * 0.65 + ")"
            ctx!.lineWidth = 1.5
            ctx!.stroke()
          }
        }
        const grd = ctx!.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 7)
        grd.addColorStop(0, arc.color + ".9)")
        grd.addColorStop(1, arc.color + "0)")
        ctx!.beginPath()
        ctx!.arc(pos.x, pos.y, 7, 0, Math.PI * 2)
        ctx!.fillStyle = grd
        ctx!.fill()
        ctx!.beginPath()
        ctx!.arc(pos.x, pos.y, 1.8, 0, Math.PI * 2)
        ctx!.fillStyle = arc.color + "1)"
        ctx!.fill()
        if (arc.t >= 1) {
          arc.done = true
          for (let k = 0; k < 12; k++) {
            const ang = (k / 12) * Math.PI * 2
            const spd = 0.4 + Math.random() * 0.9
            arc.particles.push({
              x: pos.x,
              y: pos.y,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              life: 1,
              color: arc.color,
            })
          }
        }
      })

      arcs.forEach((arc) => {
        arc.particles = arc.particles.filter((p) => p.life > 0)
        arc.particles.forEach((p) => {
          p.x += p.vx
          p.y += p.vy
          p.vx *= 0.88
          p.vy *= 0.88
          p.life -= 0.04
          ctx!.beginPath()
          ctx!.arc(p.x, p.y, 1.2, 0, Math.PI * 2)
          ctx!.fillStyle = p.color + p.life + ")"
          ctx!.fill()
        })
      })
      for (let i = arcs.length - 1; i >= 0; i--) {
        if (arcs[i].done && arcs[i].particles.length === 0) arcs.splice(i, 1)
      }

      CITIES.forEach((c, i) => {
        pulses[i].phase += 0.018
        const px = cxF(c),
          py = cyF(c)
        const isHub = c.hub
        const baseR = isHub ? 4.5 : 2.8
        const pulse = Math.sin(pulses[i].phase) * 0.5 + 0.5
        const ringR = baseR + (isHub ? 14 : 9) * pulse
        const ringAlpha = (1 - pulse) * (isHub ? 0.35 : 0.2)
        ctx!.beginPath()
        ctx!.arc(px, py, ringR, 0, Math.PI * 2)
        ctx!.strokeStyle = isHub
          ? `rgba(201,168,76,${ringAlpha})`
          : `rgba(42,107,85,${ringAlpha})`
        ctx!.lineWidth = 1
        ctx!.stroke()
        if (isHub) {
          const r2 = baseR + 26 * pulse
          ctx!.beginPath()
          ctx!.arc(px, py, r2, 0, Math.PI * 2)
          ctx!.strokeStyle = `rgba(201,168,76,${(1 - pulse) * 0.12})`
          ctx!.lineWidth = 0.8
          ctx!.stroke()
        }
        const grd = ctx!.createRadialGradient(px, py, 0, px, py, baseR * 3)
        if (isHub) {
          grd.addColorStop(0, "rgba(201,168,76,.45)")
          grd.addColorStop(1, "rgba(201,168,76,0)")
        } else {
          grd.addColorStop(0, "rgba(42,107,85,.3)")
          grd.addColorStop(1, "rgba(42,107,85,0)")
        }
        ctx!.beginPath()
        ctx!.arc(px, py, baseR * 3, 0, Math.PI * 2)
        ctx!.fillStyle = grd
        ctx!.fill()
        ctx!.beginPath()
        ctx!.arc(px, py, baseR, 0, Math.PI * 2)
        ctx!.fillStyle = isHub ? "rgba(201,168,76,.95)" : "rgba(42,107,85,.8)"
        ctx!.fill()
        ctx!.beginPath()
        ctx!.arc(px, py, baseR * 0.45, 0, Math.PI * 2)
        ctx!.fillStyle = "rgba(245,240,232,.7)"
        ctx!.fill()
      })

      // Labels: every city (hub included) uses the same placement, above
      // and to the right of its dot. Placed after all dots are drawn, hub
      // last, so a label that would cover another city's dot or label is
      // nudged further up until it's clear.
      const small = W < 480
      const placed: { x: number; y: number; w: number; h: number }[] = []
      const dotBoxes = CITIES.map((c) => ({
        x: cxF(c) - 7,
        y: cyF(c) - 7,
        w: 14,
        h: 14,
        city: c,
      }))
      const hits = (
        a: { x: number; y: number; w: number; h: number },
        b: { x: number; y: number; w: number; h: number }
      ) =>
        a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
      const order = [
        ...CITIES.filter((c) => !c.hub),
        ...CITIES.filter((c) => c.hub),
      ]
      order.forEach((c) => {
        const px = cxF(c),
          py = cyF(c)
        const isHub = c.hub
        const baseR = isHub ? 4.5 : 2.8
        const fontPx = setLabelFont(isHub, small)
        const label = c.name.toUpperCase()
        const textW = ctx!.measureText(label).width
        // flip to left only if placing right would overflow the canvas edge
        // (layoutCities reserves room, so this is just a safety net)
        const wouldOverflowRight = px + 10 + textW + 8 > W - 4
        const wouldOverflowLeft = px - textW - 12 < 4
        // on mobile, labels start a bit left of the dot to save width
        const lxRaw = small
          ? px - textW * 0.35
          : wouldOverflowRight && !wouldOverflowLeft
          ? px - textW - 12
          : px + 10
        const lx = Math.max(4, Math.min(lxRaw, W - textW - 8))
        // a little more air above the dot on phones
        let ty = py - baseR - (small ? 9 : 6)

        const box = () => ({
          x: lx - 2,
          y: ty - fontPx * 0.75, // uppercase cap height, not the full em
          w: textW + 4,
          h: fontPx * 0.75 + 4,
        })
        for (let n = 0; n < 40; n++) {
          const b = box()
          const blocked =
            placed.some((p) => hits(b, p)) ||
            dotBoxes.some((d) => d.city !== c && hits(b, d))
          if (!blocked) break
          ty -= 2
        }
        placed.push(box())

        ctx!.fillStyle = isHub ? "rgba(201,168,76,.95)" : "rgba(201,168,76,.82)"
        ctx!.fillText(label, lx, ty)
        ctx!.letterSpacing = "0px"
      })
    }

    return () => {
      stopped = true
      cvObs.disconnect()
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} id="dvizCanvas" aria-hidden="true" />
}
