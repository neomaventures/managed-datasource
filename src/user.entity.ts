import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm"

@Entity()
export class User {
  @PrimaryGeneratedColumn("uuid")
  public id!: string

  @Column()
  public username!: string

  @DeleteDateColumn()
  public deletedAt?: Date | null
}
