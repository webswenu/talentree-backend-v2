import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOnDeleteSetNullToWorkerUser1763130906003 implements MigrationInterface {
    name = 'AddOnDeleteSetNullToWorkerUser1763130906003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workers" DROP CONSTRAINT "FK_e47e873d6f19443891cca73bd8c"`);
        await queryRunner.query(`ALTER TABLE "workers" ADD CONSTRAINT "FK_e47e873d6f19443891cca73bd8c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workers" DROP CONSTRAINT "FK_e47e873d6f19443891cca73bd8c"`);
        await queryRunner.query(`ALTER TABLE "workers" ADD CONSTRAINT "FK_e47e873d6f19443891cca73bd8c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
