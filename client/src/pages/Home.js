import React from "react";
import Hero from "../components/Hero";
import FeaturedCollection from "../components/FeaturedCollection";
import EditorialGrid from "../components/EditorialGrid";
import usePageMeta from '../hooks/usePageMeta';
export default function Home() {
  usePageMeta({
    title: null,
    description: 'Considered essentials for men and women. Clean lines, honest fabric, nothing excess.',
  });

  return (
    <div>
      <Hero />
      <FeaturedCollection />
      <EditorialGrid />
    </div>
  );
}