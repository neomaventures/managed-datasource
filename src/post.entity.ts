import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm"

@Entity()
export class Post {
  @PrimaryGeneratedColumn("uuid")
  public id!: string

  @Column()
  public content!: string

  @DeleteDateColumn()
  public deletedAt?: Date | null
}
