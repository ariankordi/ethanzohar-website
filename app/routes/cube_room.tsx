import type { Route } from "./+types/home";
import { CubeRoom } from "../pages/cube_room/cube_room";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Cube Room" },
    { name: "description", content: "AAA" },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.VALUE_FROM_EXPRESS };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <CubeRoom />;
}
