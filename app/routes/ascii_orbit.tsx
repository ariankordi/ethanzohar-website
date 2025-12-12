import type { Route } from "./+types/home";
import { AsciiOrbit } from "../pages/ascii_orbit/ascii_orbit";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Ascii Orbit" },
    { name: "description", content: "AAA" },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.VALUE_FROM_EXPRESS };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <AsciiOrbit />;
}
