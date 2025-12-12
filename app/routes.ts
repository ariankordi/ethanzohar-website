import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/image_explode.tsx"),
  // route("dummy", "routes/dummy.tsx"),
  // route("mii_plaza", "routes/mii_plaza.tsx"),
  // route("mii_loader", "routes/mii_loader.tsx"),
  // route("mii_builder", "routes/mii_builder.tsx"),
  route("mii_plaza", "routes/mii_plaza_2.tsx"),
  route("ascii_orbit", "routes/ascii_orbit.tsx"),
  route("text_border", "routes/text_border.tsx"),
  route("adri", "routes/adrii.tsx"),
  route("cube_room", "routes/cube_room.tsx")
  // route("image_explode", "routes/image_explode.tsx")
] satisfies RouteConfig;
