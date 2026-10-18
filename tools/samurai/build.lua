-- Assembles the generated frames into an indexed, layered, tagged Aseprite
-- sprite. Run by build.ts in batch mode:
--   aseprite -b --script-param input=<frames.json> --script-param output=<file.aseprite> --script build.lua

local input = app.params["input"]
local output = app.params["output"]
if not input or not output then
  error("build.lua needs --script-param input=... and output=...")
end

local fh = assert(io.open(input, "r"))
local data = json.decode(fh:read("a"))
fh:close()

local spr = Sprite(data.width, data.height, ColorMode.INDEXED)
spr.transparentColor = 0

local pal = Palette(#data.palette)
for i, hex in ipairs(data.palette) do
  local r = tonumber(hex:sub(2, 3), 16)
  local g = tonumber(hex:sub(4, 5), 16)
  local b = tonumber(hex:sub(6, 7), 16)
  local a = #hex == 9 and tonumber(hex:sub(8, 9), 16) or 255
  pal:setColor(i - 1, Color { r = r, g = g, b = b, a = a })
end
spr:setPalette(pal)

-- Bottom to top, in the order the generator composites them.
local layers = { spr.layers[1] }
spr.layers[1].name = data.layers[1]
for i = 2, #data.layers do
  local l = spr:newLayer()
  l.name = data.layers[i]
  layers[i] = l
end

-- Each layer of each frame arrives as one character per pixel, row-major,
-- '0'..'9' then 'a'.. for palette indices; an empty string is an empty cel.
local function code(byte)
  if byte <= 57 then return byte - 48 end
  return byte - 87
end

for fi, fr in ipairs(data.frames) do
  if fi > 1 then spr:newEmptyFrame() end
  local frame = spr.frames[fi]
  frame.duration = data.frameMs / 1000
  for li, px in ipairs(fr) do
    if #px > 0 then
      local img = Image(data.width, data.height, ColorMode.INDEXED)
      img:clear(0)
      local w = data.width
      for i = 1, #px do
        local c = code(px:byte(i))
        if c ~= 0 then
          local k = i - 1
          img:drawPixel(k % w, k // w, c)
        end
      end
      spr:newCel(layers[li], frame, img, Point(0, 0))
    end
  end
end

for _, t in ipairs(data.tags) do
  local tag = spr:newTag(t.from, t.to)
  tag.name = t.name
end

spr:saveAs(output)
