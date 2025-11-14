import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStatusToReports1762261073457 implements MigrationInterface {
    name = 'AddStatusToReports1762261073457'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."reports_status_enum" AS ENUM('pending_approval', 'revision_evaluador', 'revision_admin', 'approved', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "reports" ADD "status" "public"."reports_status_enum" NOT NULL DEFAULT 'pending_approval'`);
        await queryRunner.query(`ALTER TABLE "reports" ADD "approvedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "reports" ADD "rejectionReason" text`);
        await queryRunner.query(`ALTER TABLE "reports" ADD "approved_by_id" uuid`);
        await queryRunner.query(`ALTER TABLE "reports" ADD CONSTRAINT "FK_062dd56373dddda315889b1198b" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "reports" DROP CONSTRAINT "FK_062dd56373dddda315889b1198b"`);
        await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "approved_by_id"`);
        await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "rejectionReason"`);
        await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "approvedAt"`);
        await queryRunner.query(`ALTER TABLE "reports" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."reports_status_enum"`);
    }

}
