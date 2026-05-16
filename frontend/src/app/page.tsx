import DisclaimerStrip from "@/components/landing/DisclaimerStrip";
import LandingNav from "@/components/landing/LandingNav";
import Hero from "@/components/landing/Hero";
import TrustStrip from "@/components/landing/TrustStrip";
import HowItWorks from "@/components/landing/HowItWorks";
import FeatureTriad from "@/components/landing/FeatureTriad";
import MomentsGallery from "@/components/landing/MomentsGallery";
import ProductPreview from "@/components/landing/ProductPreview";
import BilingualCallout from "@/components/landing/BilingualCallout";
import Testimonials from "@/components/landing/Testimonials";
import SafetySection from "@/components/landing/SafetySection";
import FinalCTA from "@/components/landing/FinalCTA";
import LandingFooter from "@/components/landing/LandingFooter";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <DisclaimerStrip />
      <LandingNav />
      <main>
        <Hero />
        <TrustStrip />
        <HowItWorks />
        <FeatureTriad />
        <MomentsGallery />
        <ProductPreview />
        <BilingualCallout />
        <Testimonials />
        <SafetySection />
        <FinalCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
