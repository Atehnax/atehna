import CategoryGrid from '@/commercial/components/landing/CategoryGrid';
import HeroSection from '@/commercial/components/landing/HeroSection';

export default function LandingPage() {
  return (
    <div className="bg-white">
      <HeroSection />
      <CategoryGrid />
    </div>
  );
}
