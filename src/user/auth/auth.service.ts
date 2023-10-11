import { ConflictException, HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { UserType } from '@prisma/client';

interface SignupParams {
  email: string;
  password: string;
  name: string;
  phone: string;
}

interface SigninParams {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  //*Sign-up validation
  async signup({ email, password, name, phone }: SignupParams) {
    //*Email validation
    const userExists = await this.prisma.user.findUnique({
      where: { email },
    });

    if (userExists) {
      throw new ConflictException();
    }

    //*Password hashing
    const hashedPassword = await bcrypt.hash(password, 10);

    //*Store user to database
    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        phone,
        password: hashedPassword,
        user_type: UserType.BUYER,
      },
    });

    //*Return JWT Token
    return this.generateJWT(name, user.id);
  }

  //*Sig-in validation
  async signin({ email, password }: SigninParams) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new HttpException('Invalid credentials', 400);
    }

    const hashedPassword = user.password;
    const isValidPassword = await bcrypt.compare(password, hashedPassword);

    if (!isValidPassword) {
      throw new HttpException('Invalid credentials', 400);
    }

    return this.generateJWT(user.name, user.id);
  }

  //*JWT Token Generator
  private generateJWT(name: string, id: number) {
    return jwt.sign(
      {
        name,
        id,
      },
      process.env.JSON_TOKEN_KEY,
      { expiresIn: 3600000 },
    );
  }
}
