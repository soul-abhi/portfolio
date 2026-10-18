-- Paints the intro's night set into art/night.aseprite and exports it.
--
--   npm run art:night
--
-- One indexed sprite, three regions (also saved as slices, so they can be
-- edited in place): two tileable ridge strips for the horizon and the moon.
-- The far ridge is lit from the moon's side; the near one carries the
-- silhouettes - pines, a small torii, a ruined tower with one lit window.
-- Everything is deterministic: run it again and you get the same pixels.

local output = app.params["output"]
local png = app.params["png"]
local data = app.params["data"]
if not output or not png or not data then
  error("paint.lua needs --script-param output=... png=... data=...")
end

-- 512 wide so the landmarks appear once across a typical screen.
local W, H = 512, 112
local FAR = Rectangle(0, 0, 512, 48)
local NEAR = Rectangle(0, 48, 512, 32)
local MOON = Rectangle(0, 80, 32, 32)

local spr = Sprite(W, H, ColorMode.INDEXED)
spr.transparentColor = 0
local hexes = {
  "#00000000",
  "#04060b", -- 1 near ridge, silhouettes
  "#070b14", -- 2 far ridge
  "#0c1322", -- 3 far ridge, lit face
  "#1a2438", -- 4 moonlit rim
  "#2d3a52", -- 5 haze
  "#9fb3c8", -- 6 moon, shadowed
  "#d9e4ee", -- 7 moon
  "#f4f8fb", -- 8 moon, bright limb
  "#3c4a64", -- 9 moon halo
  "#ffcf8a", -- 10 the window
}
local pal = Palette(#hexes)
for i, h in ipairs(hexes) do
  pal:setColor(i - 1, Color {
    r = tonumber(h:sub(2, 3), 16), g = tonumber(h:sub(4, 5), 16), b = tonumber(h:sub(6, 7), 16),
    a = #h == 9 and 0 or 255,
  })
end
spr:setPalette(pal)

local img = Image(W, H, ColorMode.INDEXED)
img:clear(0)
local function px(x, y, c)
  if x >= 0 and x < W and y >= 0 and y < H then img:drawPixel(x, y, c) end
end
local function get(x, y)
  if x < 0 or x >= W or y < 0 or y >= H then return 0 end
  return img:getPixel(x, y)
end
local TAU = math.pi * 2
-- Integer frequencies over the strip width keep both strips seamless when tiled.
local function wave(x, terms)
  local v = 0
  for _, t in ipairs(terms) do v = v + t[1] * math.sin(TAU * x / W * t[2] + t[3]) end
  return v
end

-- ---- far ridge: tall, soft, catching the moon on its left-facing slopes ----
local farH = {}
for x = 0, W - 1 do
  farH[x] = math.floor(24 + wave(x, { { 9, 2, 0.5 }, { 5, 5, 1.7 }, { 2.6, 13, 0.2 }, { 1.2, 33, 2.1 }, { 0.6, 81, 0.9 } }) + 0.5)
end
for x = 0, W - 1 do
  local top = FAR.y + FAR.height - farH[x]
  for y = top, FAR.y + FAR.height - 1 do px(x, y, 2) end
  local prev = farH[(x - 1) % W]
  local rising = farH[x] >= prev
  px(x, top, rising and 4 or 3)
  if rising then px(x, top + 1, 3) end
  -- Haze settles in the valleys: a dithered band near the foot.
  for y = FAR.y + FAR.height - 6, FAR.y + FAR.height - 1 do
    if (x + y) % 2 == 0 and get(x, y) == 2 then px(x, y, 3) end
  end
end

-- ---- near ridge: low hills, and the things standing on them ----
local nearH = {}
for x = 0, W - 1 do
  nearH[x] = math.floor(9 + wave(x, { { 3.5, 4, 2.4 }, { 2, 9, 0.3 }, { 1, 23, 1.1 }, { 0.5, 57, 0.6 } }) + 0.5)
end
local base = NEAR.y + NEAR.height
for x = 0, W - 1 do
  for y = base - nearH[x], base - 1 do px(x, y, 1) end
end

local function pine(cx, h)
  local g = base - nearH[cx]
  for i = 0, h - 1 do
    local w = math.floor((h - i) / 3)
    for dx = -w, w do px(cx + dx, g - i, 1) end
  end
  px(cx, g - h, 1)
end
for _, p in ipairs({
  { 14, 11 }, { 19, 8 }, { 23, 13 }, { 98, 9 }, { 103, 12 }, { 108, 7 }, { 214, 10 }, { 219, 14 }, { 225, 9 },
  { 247, 8 }, { 290, 9 }, { 296, 13 }, { 301, 10 }, { 352, 7 }, { 380, 12 }, { 386, 9 }, { 440, 11 }, { 446, 15 },
  { 452, 10 }, { 458, 7 }, { 495, 9 },
}) do
  pine(p[1], p[2])
end

-- A small torii: two posts, the lintel with upturned ends, the tie beam.
local tx, tg = 58, base - nearH[58]
for y = tg - 9, tg do px(tx, y, 1); px(tx + 7, y, 1) end
for x = tx - 2, tx + 9 do px(x, tg - 10, 1) end
px(tx - 3, tg - 11, 1); px(tx + 10, tg - 11, 1)
for x = tx, tx + 7 do px(x, tg - 7, 1) end

-- The ruined tower: broken crown, one warm window still lit.
local rx, rg = 170, base - nearH[170]
local crown = { 0, 2, 1, 3, 0, 1, 2 }
for i = 0, 6 do
  for y = rg - 21 + crown[i + 1], rg do px(rx + i, y, 1) end
end
for y = rg - 3, rg do px(rx - 1, y, 1); px(rx + 7, y, 1) end
px(rx + 3, rg - 14, 10)
px(rx + 3, rg - 13, 10)

-- Moonlight catches the near ridge only here and there.
for x = 0, W - 1 do
  for y = NEAR.y, base - 1 do
    if get(x, y) == 1 and get(x, y - 1) == 0 and (x * 7) % 5 == 0 then px(x, y, 3) end
  end
end

-- ---- the moon: a waxing crescent with a dithered halo ----
local mx, my = MOON.x + 16, MOON.y + 16
for y = MOON.y, MOON.y + MOON.height - 1 do
  for x = MOON.x, MOON.x + MOON.width - 1 do
    local dx, dy = x + 0.5 - mx, y + 0.5 - my
    local d = math.sqrt(dx * dx + dy * dy)
    local ex, ey = dx - 5, dy + 3
    local inner = math.sqrt(ex * ex + ey * ey)
    if d <= 10 and inner > 9 then
      local c = 7
      if d > 8.8 and dx < 0 then c = 8 end
      if inner < 10.2 then c = 6 end
      px(x, y, c)
    elseif d > 10 and d <= 15 then
      -- Fewer halo pixels the further out, on an ordered pattern.
      local bayer = { { 0, 8, 2, 10 }, { 12, 4, 14, 6 }, { 3, 11, 1, 9 }, { 15, 7, 13, 5 } }
      local th = bayer[(y % 4) + 1][(x % 4) + 1] / 16
      if (15 - d) / 5 * 0.55 > th then px(x, y, 9) end
    end
  end
end
-- A few craters on the lit body.
for _, c in ipairs({ { -6, 3 }, { -5, -4 }, { -7, -1 }, { -3, 6 } }) do
  if get(mx + c[1], my + c[2]) == 7 then px(mx + c[1], my + c[2], 6) end
end

spr.layers[1].name = "night"
spr:newCel(spr.layers[1], 1, img, Point(0, 0))
for name, r in pairs({ far = FAR, near = NEAR, moon = MOON }) do
  local s = spr:newSlice(r)
  s.name = name
end
spr:saveAs(output)
spr:saveCopyAs(png)

local fh = assert(io.open(data, "w"))
fh:write(json.encode({
  far = { FAR.x, FAR.y, FAR.width, FAR.height },
  near = { NEAR.x, NEAR.y, NEAR.width, NEAR.height },
  moon = { MOON.x, MOON.y, MOON.width, MOON.height },
}))
fh:write("\n")
fh:close()
