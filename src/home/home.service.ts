import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { HomeResponseDto } from './home.dto';
import { PropertyType } from '@prisma/client';
import { UserInfo } from 'src/user/decorators/user.decorator';

interface GetHomesParam {
  city?: string;
  price?: {
    gte?: number;
    lte?: number;
  };
  propertyType?: PropertyType;
}

interface CreateHomeParam {
  address: string;
  numberOfBedrooms: number;
  numberOfBathrooms: number;
  city: string;
  price: number;
  landSize: number;
  propertyType: PropertyType;
  // An array of objects where each url is a string
  images: { url: string }[];
}

interface UpdateHomeParam {
  address?: string;
  numberOfBedrooms?: number;
  numberOfBathrooms?: number;
  city?: string;
  price?: number;
  landSize?: number;
  propertyType?: PropertyType;
  // An array of objects where each url is a string
  images?: { url: string }[];
}

export const homeSelect = {
  id: true,
  address: true,
  city: true,
  price: true,
  propertyType: true,
  number_of_bathrooms: true,
  number_of_bedrooms: true,
};

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}
  async getHomes(filter: GetHomesParam): Promise<HomeResponseDto[]> {
    const homes = await this.prisma.home.findMany({
      select: {
        ...homeSelect,
        images: {
          select: {
            url: true,
          },
          take: 1,
        },
      },
      where: filter,
    });

    if (!homes.length) {
      throw new NotFoundException();
    }
    return homes.map((home) => {
      const { images, ...fetchHome } = home;
      return new HomeResponseDto({ ...fetchHome, image: images[0].url });
    });

    //Alternative
    //   return homes.map ( home => {
    //     const fetchHome = { ...home, image: home.images[0].url }
    //     delete fetchHome.images
    //     return new HomeResponseDto(fetchHome)
    //   },
    // );
  }

  async getHomeById(id: number) {
    const home = await this.prisma.home.findUnique({
      where: { id },
      select: {
        ...homeSelect,
        images: {
          select: {
            url: true,
          },
        },
        realtor: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });
    if (!home) {
      throw new NotFoundException();
    }

    return new HomeResponseDto(home);
  }

  async createHome(
    {
      address,
      numberOfBedrooms,
      numberOfBathrooms,
      city,
      landSize,
      price,
      propertyType,
      images,
    }: CreateHomeParam,
    userId: number,
  ) {
    const home = await this.prisma.home.create({
      data: {
        address,
        number_of_bathrooms: numberOfBathrooms,
        number_of_bedrooms: numberOfBedrooms,
        city,
        land_size: landSize,
        propertyType,
        price,
        realtor_id: userId,
      },
    });

    const homeImages = images.map((image) => {
      return { ...image, home_id: home.id };
    });

    await this.prisma.image.createMany({ data: homeImages });

    return new HomeResponseDto(home);
  }

  async updateHomeById(id: number, data: UpdateHomeParam) {
    const home = await this.prisma.home.findUnique({ where: { id } });

    if (!home) {
      throw new NotFoundException();
    }

    const updatedData = {
      ...data,
      images: data.images
        ? {
            updateMany: data.images.map((image) => ({
              where: { url: image.url },
              data: image,
            })),
          }
        : undefined,
    };

    const updatedHome = await this.prisma.home.update({
      where: { id },
      data: updatedData,
    });

    return new HomeResponseDto(updatedHome);
  }

  async deleteHomeById(id: number) {
    await this.prisma.image.deleteMany({ where: { home_id: id } });
    await this.prisma.home.delete({
      where: { id },
    });
  }

  async getRealtorByHomeId(id: number) {
    const home = await this.prisma.home.findUnique({
      where: { id },
      select: {
        realtor: { select: { name: true, id: true, email: true, phone: true } },
      },
    });

    if (!home) {
      throw new NotFoundException();
    }

    return home.realtor;
  }

  async inquire(buyer: UserInfo, homeId: number, message: string) {
    const realtor = await this.getRealtorByHomeId(homeId);
    return this.prisma.message.create({
      data: {
        realtor_id: realtor.id,
        buyer_id: buyer.id,
        home_id: homeId,
        message,
      },
    });
  }

  getMessagesByHome(homeId: number) {
    return this.prisma.message.findMany({
      where: { home_id: homeId },
      select: {
        message: true,
        buyer: {
          select: {
            name: true,
            phone: true,
            email: true,
          },
        },
      },
    });
  }
}
