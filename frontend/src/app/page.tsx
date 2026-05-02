import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import FeatureGrid from "@/components/landing/FeatureGrid";
import TestimonialBand from "@/components/landing/TestimonialBand";
import PrivacyStripe from "@/components/landing/PrivacyStripe";
import FinalCTA from "@/components/landing/FinalCTA";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />

      <main>
        <Hero />
        <HowItWorks />
        <FeatureGrid />
        <TestimonialBand />
        <PrivacyStripe />
        <FinalCTA />
      </main>

      <LandingFooter />
    </div>
  );
}
