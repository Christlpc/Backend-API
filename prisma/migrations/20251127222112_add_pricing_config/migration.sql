-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "vipTier" TEXT;

-- CreateTable
CREATE TABLE "PricingConfig" (
    "id" SERIAL NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "pricePerKm" DOUBLE PRECISION NOT NULL,
    "pricePerMin" DOUBLE PRECISION NOT NULL,
    "fuelIndex" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingConfig_serviceType_key" ON "PricingConfig"("serviceType");
