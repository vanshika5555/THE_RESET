import React from "react";
import Hero from "../components/Hero";
import FeaturedCollection from "../components/FeaturedCollection";
import EditorialGrid from "../components/EditorialGrid";
export default function Home() {
  return (
    <div>
      <Hero />
      <FeaturedCollection />
      <EditorialGrid />
    </div>
  );
}