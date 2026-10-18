-- Bakes the intro's lantern-bearer from art/wanderer.aseprite.
--
--   npm run art:wanderer
--
-- The source file holds one still pose in two layers (character, ground) and
-- a few named slices that say where to move what:
--   staff    the staff and the hand on it: rises and falls rigidly
--   arm      the forearm between shoulder and hand: bends to follow the hand
--   breath   the upper body: rises a pixel on the in-breath
--   cape     the tattered cape: sways, more toward the hem
--   lantern  where the flame is, for the glow the intro draws over it
--   foot     the tip of the staff, where it strikes the ground
-- Edit the pixels or move the slices in Aseprite, then run this again. Every
-- frame is the still pose pushed around pixel by pixel, never redrawn, so it
-- stays exactly the art in the file.

local input = app.params["input"]
local sheet = app.params["sheet"]
local data = app.params["data"]
if not input or not sheet or not data then
  error("animate.lua needs --script-param input=... sheet=... data=...")
end

local base = app.open(input)
local W, H = base.width, base.height

local function slice(name)
  for _, s in ipairs(base.slices) do
    if s.name == name then return s.bounds end
  end
  error("art is missing the '" .. name .. "' slice")
end
local STAFF, ARM, BREATH, CAPE = slice("staff"), slice("arm"), slice("breath"), slice("cape")
local LANTERN, FOOT = slice("lantern"), slice("foot")

local function layerImage(name)
  for _, l in ipairs(base.layers) do
    if l.name == name then
      local img = Image(W, H, ColorMode.INDEXED)
      img:clear(0)
      local cel = l:cel(1)
      -- Pixel by pixel on purpose: drawImage between loose indexed images
      -- remaps through a 32-colour default palette.
      if cel then
        local p = cel.position
        for it in cel.image:pixels() do
          local v = it()
          if v ~= 0 then img:drawPixel(it.x + p.x, it.y + p.y, v) end
        end
      end
      return img
    end
  end
  error("art is missing the '" .. name .. "' layer")
end
local CHAR, GROUND = layerImage("character"), layerImage("ground")

-- The flame flickers by stepping each warm colour up or down its own ramp.
local pal = base.palettes[1]
local warm = {}
for i = 1, #pal - 1 do
  local c = pal:getColor(i)
  if c.red > c.green + 25 and c.red > 120 then
    warm[#warm + 1] = { i = i, lum = c.red * 0.299 + c.green * 0.587 + c.blue * 0.114 }
  end
end
table.sort(warm, function(a, b) return a.lum < b.lum end)
local warmRank = {}
for r, w in ipairs(warm) do warmRank[w.i] = r end

local function inside(r, x, y)
  return x >= r.x and x < r.x + r.width and y >= r.y and y < r.y + r.height
end

local function round(v) return math.floor(v + 0.5) end

-- ---------------------------------------------------------------------------
-- Timeline. Each frame: duration, staff lift, cape phase and swing, breath,
-- flame step. Idle loops while the site loads; the rest plays once.
-- ---------------------------------------------------------------------------

local frames, tags = {}, {}
local function tag(name, from) tags[#tags + 1] = { name = name, from = from, to = #frames } end
local FLICKER = { 0, 1, 0, 0, -1, 0, 1, 1, 0, -1, 0, 0, 1, 0, -1, 0 }

local phase = 0
local function add(ms, lift, swing, breath, flame, impact)
  frames[#frames + 1] = { ms = ms, lift = lift, phase = phase, swing = swing, breath = breath, flame = flame, impact = impact }
end

local IDLE = 16
local from = #frames + 1
for i = 0, IDLE - 1 do
  phase = 2 * math.pi * i / IDLE
  add(100, 0, 1.6, math.sin(phase) > 0.2 and 1 or 0, FLICKER[i + 1])
end
tag("idle", from)

-- He lifts the staff, slowly, keeping it upright.
local LIFT = 6
from = #frames + 1
for i = 1, 12 do
  local t = i / 12
  local e = t < 0.5 and 4 * t * t * t or 1 - (-2 * t + 2) ^ 3 / 2
  phase = phase + 2 * math.pi / IDLE * 0.8
  add(60, round(LIFT * e), 1.6, i < 7 and 1 or 0, FLICKER[(i % 16) + 1])
end
tag("raise", from)

-- A held breath at the top, a pixel higher for the anticipation.
from = #frames + 1
add(90, LIFT, 1.4, 0, 1)
add(90, LIFT + 1, 1.2, 0, 1)
add(110, LIFT + 1, 1.0, 0, 1)
tag("hold", from)

-- The strike: accelerating into the ground.
from = #frames + 1
add(40, 4, 1.0, 0, 1)
add(35, 1, 1.0, 0, 1)
add(90, 0, 1.0, 0, 2, true)
tag("strike", from)

-- The shock runs up the staff and out through the cape.
from = #frames + 1
local settle = { { 1, 3.2 }, { 0, 3.0 }, { 0, 2.5 }, { 0, 2.0 }, { 0, 1.6 }, { 0, 1.2 } }
for i, s in ipairs(settle) do
  phase = phase + 2 * math.pi / IDLE * 1.6
  add(70, s[1], s[2], 0, i < 3 and 2 or 1)
end
tag("settle", from)

-- ---------------------------------------------------------------------------
-- Rendering: every output pixel samples the still pose somewhere nearby.
-- ---------------------------------------------------------------------------

local function render(f)
  local out = Image(GROUND)
  for y = 0, H - 1 do
    for x = 0, W - 1 do
      local sx, sy = x, y
      if inside(STAFF, x, y) then
        sy = y + f.lift
      elseif inside(ARM, x, y) then
        local t = (x - ARM.x) / ARM.width
        sy = y + round(f.lift * t + f.breath * (1 - t))
      elseif inside(BREATH, x, y) then
        sy = y + f.breath
      end
      if inside(CAPE, x, y) then
        local w = math.min(1, math.max(0, (y - CAPE.y) / CAPE.height)) ^ 1.6
        sx = x - round(f.swing * w * math.sin(f.phase - y * 0.09))
      end
      if sx >= 0 and sx < W and sy >= 0 and sy < H then
        local c = CHAR:getPixel(sx, sy)
        if c ~= 0 then
          local r = warmRank[c]
          if r and f.flame ~= 0 then
            c = warm[math.max(1, math.min(#warm, r + f.flame))].i
          end
          out:drawPixel(x, y, c)
        end
      end
    end
  end
  return out
end

local spr = Sprite(W, H, ColorMode.INDEXED)
spr.transparentColor = 0
-- A copy: a new sprite starts on the 32-colour default, and indices past it would be lost.
spr:setPalette(Palette(pal))
local layer = spr.layers[1]
layer.name = "wanderer"
for i, f in ipairs(frames) do
  if i > 1 then spr:newEmptyFrame() end
  spr.frames[i].duration = f.ms / 1000
  spr:newCel(layer, i, render(f), Point(0, 0))
end
for _, t in ipairs(tags) do
  local tg = spr:newTag(t.from, t.to)
  tg.name = t.name
end

local raw = sheet .. ".json"
app.command.ExportSpriteSheet {
  ui = false,
  type = SpriteSheetType.PACKED,
  textureFilename = sheet,
  dataFilename = raw,
  dataFormat = SpriteSheetDataFormat.JSON_ARRAY,
  trim = true,
  mergeDuplicates = true,
}

local fh = assert(io.open(raw, "r"))
local exported = json.decode(fh:read("a"))
fh:close()
os.remove(raw)

-- One flat row per frame: sheet rect, offset in the cell, duration ms, staff lift.
local rows, impact = {}, 0
for i, f in ipairs(frames) do
  local e = exported.frames[i]
  rows[i] = { e.frame.x, e.frame.y, e.frame.w, e.frame.h, e.spriteSourceSize.x, e.spriteSourceSize.y, f.ms, f.lift }
  if f.impact then impact = i - 1 end
end
local tagOut = {}
for _, t in ipairs(tags) do tagOut[t.name] = { t.from - 1, t.to - 1 } end

local out = assert(io.open(data, "w"))
out:write(json.encode({
  w = W,
  h = H,
  lantern = { LANTERN.x + LANTERN.width / 2, LANTERN.y + LANTERN.height / 2 },
  foot = { FOOT.x, FOOT.y },
  impact = impact,
  tags = tagOut,
  frames = rows,
}))
out:write("\n")
out:close()
spr:close()
