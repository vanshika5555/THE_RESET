import React from "react";
import usePageMeta from '../hooks/usePageMeta';
import Hero from "../components/Hero";
import FeaturedCollection from "../components/FeaturedCollection";
import NewArrivals from "../components/NewArrivals";
import PromiseStrip from "../components/PromiseStrip";
import Testimonials from "../components/Testimonials";
import EditorialGrid from "../components/EditorialGrid";

export default function Home() {
  usePageMeta({
    title: null,
    description: 'Considered essentials for men and women. Clean lines, honest fabric, nothing excess.',
  });

  return (
    <div>
      <Hero />
      <FeaturedCollection />
      <NewArrivals />
      <PromiseStrip />
      <Testimonials />
      <EditorialGrid />
    </div>
  );
}