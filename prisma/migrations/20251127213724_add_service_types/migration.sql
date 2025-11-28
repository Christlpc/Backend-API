/*
  Warnings:

  - You are about to drop the column `price` on the `Ride` table. All the data in the column will be lost.
  - Added the required column `estimatedPrice` to the `Ride` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serviceType` to the `Ride` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Vehicle` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('TAXI', 'MOTO', 'CONFORT', 'VIP');

-- AlterTable
ALTER TABLE "Ride" DROP COLUMN "price",
ADD COLUMN     "estimatedPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "finalPrice" DOUBLE PRECISION,
ADD COLUMN     "serviceType" "ServiceType" NOT NULL;

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "type",
ADD COLUMN     "type" "ServiceType" NOT NULL;
